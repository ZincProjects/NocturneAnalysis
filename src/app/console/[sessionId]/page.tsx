import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SocConsole } from "@/components/console/soc-console";
import { getScenarioBundle, listMitreTechniques, listOwaspCategories } from "@/lib/content/loader";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import type { SessionEvent } from "@/lib/events/types";

export const metadata: Metadata = {
  title: "SOC Console",
  // A live workbench has nothing useful to offer a search engine and every
  // URL contains a session id.
  robots: { index: false, follow: false },
};

export default async function ConsolePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/console/${sessionId}`);

  const supabase = await createClient();

  // RLS does the access control: a session belonging to someone else simply
  // does not come back.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, scenario_id, user_id, status, current_phase, started_at, is_sample")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) notFound();

  const { data: scenarioRow } = await supabase
    .from("scenarios")
    .select("slug")
    .eq("id", session.scenario_id)
    .maybeSingle();

  if (!scenarioRow) notFound();

  const bundle = getScenarioBundle(scenarioRow.slug);
  if (!bundle) notFound();

  // A submitted session is read-only; the review lives at /report.
  if (session.status !== "in_progress" && session.user_id === viewer.userId) {
    redirect(`/console/${sessionId}/report`);
  }

  const { data: eventRows } = await supabase
    .from("session_events")
    .select("*")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true });

  const events: SessionEvent[] = (eventRows ?? []).map((row) => ({
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    event_type: row.event_type,
    phase: row.phase,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    created_at: row.created_at,
    prev_hash: row.prev_hash,
    hash: row.hash,
    client_meta: (row.client_meta ?? null) as Record<string, unknown> | null,
  }));

  const techniqueIds = new Set(
    bundle.scenario.phases
      .flatMap((p) => p.decisions)
      .flatMap((d) => d.options.map((o) => o.value))
      .concat(bundle.scenario.mitre_techniques),
  );

  return (
    <SocConsole
      sessionId={sessionId}
      startedAt={session.started_at}
      bundle={bundle}
      initialEvents={events}
      analystHandle={viewer.profile.handle}
      techniques={listMitreTechniques().filter((t) => techniqueIds.has(t.technique_id))}
      owasp={listOwaspCategories().filter((c) =>
        bundle.scenario.owasp_categories.includes(c.code),
      )}
    />
  );
}
