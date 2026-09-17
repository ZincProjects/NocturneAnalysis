import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { hasServiceRoleKey } from "@/lib/supabase/admin";

/**
 * The organiser screen is gated by one passcode from the CTF_ADMIN_PASSCODE
 * environment variable - no accounts. After a correct passcode the browser gets
 * an httpOnly cookie holding an HMAC derived from it, so the passcode itself is
 * never stored client-side, and changing the variable signs everyone out.
 */

export const ADMIN_COOKIE = "nocturne_ctf_admin";

function adminPasscode(): string | null {
  const value = process.env.CTF_ADMIN_PASSCODE;
  return value && value.length >= 8 ? value : null;
}

function sessionValue(passcode: string): string {
  return createHmac("sha256", passcode).update("nocturne-ctf-admin-session").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export type AdminConfigProblem = "no_passcode" | "no_service_role" | null;

export function adminConfigProblem(): AdminConfigProblem {
  if (!adminPasscode()) return "no_passcode";
  if (!hasServiceRoleKey()) return "no_service_role";
  return null;
}

export function passcodeMatches(candidate: string): boolean {
  const passcode = adminPasscode();
  if (!passcode) return false;
  return safeEqual(sessionValue(candidate), sessionValue(passcode));
}

export async function startAdminSession(): Promise<void> {
  const passcode = adminPasscode();
  if (!passcode) return;
  const store = await cookies();
  store.set(ADMIN_COOKIE, sessionValue(passcode), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function endAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const passcode = adminPasscode();
  if (!passcode) return false;
  const store = await cookies();
  const value = store.get(ADMIN_COOKIE)?.value;
  return Boolean(value) && safeEqual(value!, sessionValue(passcode));
}
