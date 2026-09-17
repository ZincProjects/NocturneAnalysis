"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { hashFlag } from "@/lib/ctf/flag";
import {
  clearPlayerToken,
  ctfDb,
  ctfErrorCode,
  ctfMessage,
  readPlayerToken,
  setPlayerToken,
} from "@/lib/ctf/server";
import type { CtfHint, CtfSubmitResult } from "@/lib/ctf/types";

/**
 * Player actions for Nocturne CTF. Every rule - the event window, the
 * passcode, the lockout, one solve per challenge - is enforced by the database
 * function each one calls. These only carry the token cookie across.
 */

export interface JoinState {
  error: string | null;
}

export async function joinCtf(_prev: JoinState, form: FormData): Promise<JoinState> {
  const db = ctfDb();
  if (!db) return { error: "The CTF is not configured on this deployment." };

  const handle = String(form.get("handle") ?? "").slice(0, 64);
  const team = String(form.get("team") ?? "").slice(0, 64);
  const passcode = String(form.get("passcode") ?? "").slice(0, 128);

  const { data, error } = await db.rpc("ctf_join", {
    p_handle: handle,
    p_team: team,
    p_passcode: passcode,
  });

  if (error) return { error: ctfMessage(ctfErrorCode(error)) };

  const { token } = data as unknown as { token: string };
  await setPlayerToken(token);
  redirect("/ctf/challenges");
}

export async function leaveCtf(): Promise<void> {
  await clearPlayerToken();
  redirect("/ctf");
}

export async function submitFlag(slug: string, value: string): Promise<CtfSubmitResult> {
  const db = ctfDb();
  const token = await readPlayerToken();
  if (!db || !token) return { result: "error", message: ctfMessage("no_player") };

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) return { result: "error", message: ctfMessage("bad_value") };

  const { data, error } = await db.rpc("ctf_submit", {
    p_token: token,
    p_slug: slug,
    p_value: trimmed,
    p_flag_hash: hashFlag(trimmed),
  });

  if (error) return { result: "error", message: ctfMessage(ctfErrorCode(error)) };

  const result = data as unknown as CtfSubmitResult;
  if (result.result === "correct") {
    revalidatePath("/ctf/challenges");
    revalidatePath(`/ctf/challenges/${slug}`);
  }
  return result;
}

export async function revealHint(
  slug: string,
): Promise<{ hint: CtfHint | null; error: string | null }> {
  const db = ctfDb();
  const token = await readPlayerToken();
  if (!db || !token) return { hint: null, error: ctfMessage("no_player") };

  const { data, error } = await db.rpc("ctf_reveal_hint", { p_token: token, p_slug: slug });
  if (error) return { hint: null, error: ctfMessage(ctfErrorCode(error)) };

  revalidatePath(`/ctf/challenges/${slug}`);
  return { hint: data as unknown as CtfHint, error: null };
}
