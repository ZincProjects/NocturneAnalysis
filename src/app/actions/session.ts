"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth/session";
import { getScenarioBundle } from "@/lib/content/loader";

/**
 * Starts a session, or resumes the one already open for this scenario.
 *
 * Resuming rather than starting fresh matters more than it looks: a student
 * who closes the tab, or whose Chromebook sleeps through a lesson change,
 * should come back to the incident they were working, not to a blank queue
 * with their audit trail stranded on an abandoned session.
 */
export async function startSession(slug: string): Promise<void> {
  const viewer = await requireViewer();
  const bundle = getScenarioBundle(slug);
  if (!bundle) throw new Error(`Unknown scenario: ${slug}`);

  const supabase = await createClient();

  const { data: scenario } = await supabase
    .from("scenarios")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!scenario) {
    throw new Error(
      `The scenario "${slug}" exists in the content library but not in the database. Run \`npm run db:apply\`.`,
    );
  }

  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("scenario_id", scenario.id)
    .eq("user_id", viewer.userId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) redirect(`/console/${existing.id}`);

  const { data: created, error } = await supabase
    .from("sessions")
    .insert({
      scenario_id: scenario.id,
      user_id: viewer.userId,
      org_id: viewer.profile.org_id,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Could not start the session: ${error.message}`);

  redirect(`/console/${created.id}`);
}
