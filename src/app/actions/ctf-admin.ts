"use server";

import { revalidatePath } from "next/cache";

import {
  adminConfigProblem,
  endAdminSession,
  isAdmin,
  passcodeMatches,
  startAdminSession,
} from "@/lib/ctf/admin";
import { sha256Hex } from "@/lib/ctf/flag";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Organiser actions. Each one re-checks the admin cookie itself: a server
 * action is a public POST endpoint, whichever page happens to render its form.
 */

export interface AdminFormState {
  error: string | null;
  ok?: string | null;
}

async function requireAdmin() {
  if (adminConfigProblem() || !(await isAdmin())) {
    throw new Error("Not signed in to the CTF organiser screen.");
  }
  return createAdminClient();
}

export async function adminSignIn(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  if (adminConfigProblem()) return { error: "The organiser screen is not configured." };
  const passcode = String(form.get("passcode") ?? "");
  if (!passcodeMatches(passcode)) {
    // Slow down guessing; the passcode is the only lock on this screen.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { error: "That passcode is not right." };
  }
  await startAdminSession();
  revalidatePath("/ctf/admin");
  return { error: null };
}

export async function adminSignOut(): Promise<void> {
  await endAdminSession();
  revalidatePath("/ctf/admin");
}

export async function updateEvent(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  const db = await requireAdmin();

  const title = String(form.get("title") ?? "").trim() || "Nocturne CTF";
  const startsAt = new Date(String(form.get("starts_at") ?? ""));
  const endsAt = new Date(String(form.get("ends_at") ?? ""));
  const isActive = form.get("is_active") === "on";
  const passcodeMode = String(form.get("passcode_mode") ?? "keep");
  const passcode = String(form.get("passcode") ?? "").trim();

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return { error: "Enter both a start and an end time." };
  }
  if (endsAt <= startsAt) return { error: "The end time must be after the start time." };
  if (title.length > 80) return { error: "Keep the title under 80 characters." };

  const row: {
    id: number;
    title: string;
    starts_at: string;
    ends_at: string;
    is_active: boolean;
    updated_at: string;
    passcode_hash?: string | null;
  } = {
    id: 1,
    title,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  if (passcodeMode === "set") {
    if (passcode.length < 4 || passcode.length > 64) {
      return { error: "Passcodes are 4 to 64 characters." };
    }
    row.passcode_hash = sha256Hex(passcode);
  } else if (passcodeMode === "clear") {
    row.passcode_hash = null;
  }

  const { error } = await db.from("ctf_event").upsert(row, { onConflict: "id" });
  if (error) return { error: error.message };

  revalidatePath("/ctf", "layout");
  return { error: null, ok: "Event saved." };
}

export async function setChallengeActive(slug: string, active: boolean): Promise<void> {
  const db = await requireAdmin();
  const { error } = await db.from("ctf_challenges").update({ is_active: active }).eq("slug", slug);
  if (error) throw new Error(error.message);
  revalidatePath("/ctf", "layout");
}

/** Clears a player's solves and hint reveals. The handle stays registered. */
export async function resetPlayer(playerId: string): Promise<void> {
  const db = await requireAdmin();
  const submissions = await db.from("ctf_submissions").delete().eq("player_id", playerId);
  if (submissions.error) throw new Error(submissions.error.message);
  const hints = await db.from("ctf_hint_reveals").delete().eq("player_id", playerId);
  if (hints.error) throw new Error(hints.error.message);
  revalidatePath("/ctf", "layout");
}

/** Removes a player entirely, freeing the handle. Their browser is signed out. */
export async function removePlayer(playerId: string): Promise<void> {
  const db = await requireAdmin();
  const { error } = await db.from("ctf_players").delete().eq("id", playerId);
  if (error) throw new Error(error.message);
  revalidatePath("/ctf", "layout");
}
