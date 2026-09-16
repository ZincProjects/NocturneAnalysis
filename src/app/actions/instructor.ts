"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { requireSupabaseEnv } from "@/lib/supabase/env";

/**
 * Instructor annotations and grade adjustments.
 *
 * Both write a row *and* append an event. That is the point: the audit log is
 * the record of everything that happened to a session, and an instructor
 * changing a grade is something that happened to the session. A student
 * looking at their own timeline can see that a human intervened, when, and
 * what they said.
 *
 * Nothing here mutates existing history. A correction is a new comment, not an
 * edited one - the database would refuse the edit anyway.
 */

/** Appends an event via the Edge Function, which re-checks the caller's role. */
async function appendEvent(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<void> {
  const { url, anonKey } = requireSupabaseEnv();

  const response = await fetch(`${url}/functions/v1/append-event`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: anonKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(detail.error ?? `The event service returned ${response.status}`);
  }
}

export async function addInstructorComment(input: {
  sessionId: string;
  comment: string;
  phase?: string | null;
}): Promise<void> {
  const viewer = await requireStaff();
  const supabase = await createClient();

  const comment = input.comment.trim();
  if (comment.length < 3) throw new Error("A comment needs to say something.");

  const { error } = await supabase.from("instructor_comments").insert({
    session_id: input.sessionId,
    instructor_id: viewer.userId,
    comment,
    phase: (input.phase ?? null) as never,
  });

  if (error) throw new Error(error.message);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    await appendEvent(session.access_token, {
      session_id: input.sessionId,
      event_type: "INSTRUCTOR_COMMENT",
      phase: input.phase ?? null,
      payload: { comment, instructor_handle: viewer.profile.handle },
    });
  }

  revalidatePath(`/admin/sessions/${input.sessionId}`);
}

export async function adjustGrade(input: {
  sessionId: string;
  score: number;
  note?: string;
}): Promise<void> {
  const viewer = await requireStaff();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("sessions")
    .select("max_score, org_id")
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!current) throw new Error("Session not found");

  const maxScore = current.max_score ?? 0;
  if (!Number.isInteger(input.score) || input.score < 0 || input.score > maxScore) {
    throw new Error(`The score must be a whole number between 0 and ${maxScore}.`);
  }

  const { error } = await supabase
    .from("sessions")
    .update({ adjusted_score: input.score, status: "graded" })
    .eq("id", input.sessionId);

  if (error) throw new Error(error.message);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    await appendEvent(session.access_token, {
      session_id: input.sessionId,
      event_type: "GRADE_ASSIGNED",
      phase: null,
      payload: {
        score: input.score,
        max_score: maxScore,
        adjusted_by: viewer.profile.handle,
        note: input.note?.trim() || undefined,
      },
    });
  }

  revalidatePath(`/admin/sessions/${input.sessionId}`);
  revalidatePath("/admin");
}
