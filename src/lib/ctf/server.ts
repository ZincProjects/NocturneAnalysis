import "server-only";

import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { readSupabaseEnv } from "@/lib/supabase/env";

import type {
  CtfChallengeDetail,
  CtfEvent,
  CtfPlayerState,
  CtfScoreboard,
} from "./types";

/**
 * Server-side access to Nocturne CTF.
 *
 * CTF players are not Supabase Auth users, so this uses a plain anon client
 * with no session. Every call goes through a `ctf_*` database function, which
 * identifies the player from the token and enforces the rules; the tables
 * themselves are closed to the anon role.
 *
 * The player token lives in an httpOnly cookie. Browser JavaScript never sees
 * it, so a script injected into a challenge page cannot steal a player's seat.
 */

export const PLAYER_COOKIE = "nocturne_ctf_player";

export function ctfDb() {
  const env = readSupabaseEnv();
  if (!env) return null;
  return createSupabaseClient<Database>(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function readPlayerToken(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(PLAYER_COOKIE)?.value;
  return token && /^[0-9a-f]{32,128}$/.test(token) ? token : null;
}

export async function setPlayerToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(PLAYER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearPlayerToken(): Promise<void> {
  const store = await cookies();
  store.delete(PLAYER_COOKIE);
}

/** The `ctf:<code>` part of a database exception, or null for anything else. */
export function ctfErrorCode(error: { message?: string } | null | undefined): string | null {
  const match = /ctf:([a-z_]+)/.exec(error?.message ?? "");
  return match ? match[1] : null;
}

const MESSAGES: Record<string, string> = {
  not_open: "The CTF is not open yet. Ask your organiser when it starts.",
  ended: "This CTF has ended, so no new players can join. The scoreboard is still up.",
  bad_passcode: "That event passcode is not right.",
  bad_handle: "Handles are 3 to 24 characters: letters, numbers, dots, dashes and underscores, starting with a letter or number.",
  bad_team: "Team names can be up to 32 characters.",
  busy: "Lots of people are joining right now. Try again in a minute.",
  handle_taken: "That handle is taken. Pick another.",
  no_player: "Join the CTF first.",
  not_live: "The CTF is not running right now.",
  no_challenge: "That challenge does not exist or has been switched off.",
  bad_value: "Enter a flag of up to 200 characters.",
  already_solved: "You have already solved this one.",
  no_more_hints: "There are no more hints for this challenge.",
};

export function ctfMessage(code: string | null): string {
  return (code && MESSAGES[code]) || "Something went wrong. Try again.";
}

export async function getEvent(): Promise<CtfEvent | null> {
  const db = ctfDb();
  if (!db) return null;
  const { data, error } = await db.rpc("ctf_event_info");
  if (error) throw new Error(error.message);
  return data as unknown as CtfEvent;
}

export async function getPlayerState(): Promise<CtfPlayerState | null> {
  const db = ctfDb();
  const token = await readPlayerToken();
  if (!db || !token) return null;
  const { data, error } = await db.rpc("ctf_player_state", { p_token: token });
  if (error) throw new Error(error.message);
  return (data as unknown as CtfPlayerState | null) ?? null;
}

export async function getChallengeDetail(
  slug: string,
): Promise<{ detail: CtfChallengeDetail | null; code: string | null }> {
  const db = ctfDb();
  const token = await readPlayerToken();
  if (!db || !token) return { detail: null, code: "no_player" };
  const { data, error } = await db.rpc("ctf_challenge_detail", { p_token: token, p_slug: slug });
  if (error) {
    const code = ctfErrorCode(error);
    if (code) return { detail: null, code };
    throw new Error(error.message);
  }
  return { detail: (data as unknown as CtfChallengeDetail | null) ?? null, code: null };
}

export async function getScoreboard(): Promise<CtfScoreboard | null> {
  const db = ctfDb();
  if (!db) return null;
  const { data, error } = await db.rpc("ctf_public_scoreboard");
  if (error) throw new Error(error.message);
  return data as unknown as CtfScoreboard;
}
