import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AttackHeatmap } from "@/components/mitre/attack-heatmap";
import { ScenarioOutcomes } from "@/components/admin/scenario-outcomes";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listMitreTactics, listMitreTechniques, listScenarios } from "@/lib/content/loader";
import { formatDuration } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Cohort analytics",
  robots: { index: false, follow: false },
};

export default async function AdminAnalyticsPage() {
  const viewer = await requireStaff();
  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, scenario_id, user_id, status, score, max_score, started_at, completed_at")
    .eq("org_id", viewer.profile.org_id);

  const { data: scenarioRows } = await supabase.from("scenarios").select("id, slug, title");
  const slugById = new Map((scenarioRows ?? []).map((s) => [s.id, s.slug]));
  const bundles = listScenarios();

  const finished = (sessions ?? []).filter((s) => s.status !== "in_progress");

  const perScenario = bundles.map(({ scenario }) => {
    const rows = finished.filter((s) => slugById.get(s.scenario_id) === scenario.slug);
    const scored = rows.filter((s) => s.score !== null && s.max_score);
    const durations = rows
      .filter((s) => s.completed_at)
      .map((s) => Date.parse(s.completed_at!) - Date.parse(s.started_at));

    return {
      slug: scenario.slug,
      title: scenario.title,
      category: scenario.category,
      difficulty: scenario.difficulty,
      attempts: rows.length,
      averagePercent:
        scored.length > 0
          ? Math.round(
              (scored.reduce((sum, s) => sum + (s.score ?? 0) / (s.max_score ?? 1), 0) /
                scored.length) *
                100,
            )
          : null,
      medianDuration:
        durations.length > 0
          ? formatDuration(durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)])
          : null,
    };
  });

  const covered = new Set(
    finished.flatMap((s) => {
      const slug = slugById.get(s.scenario_id);
      return bundles.find((b) => b.scenario.slug === slug)?.scenario.mitre_techniques ?? [];
    }),
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outcomes by scenario</CardTitle>
          <CardDescription>
            Average score and median time for completed attempts in {viewer.org.name}. A scenario
            where everyone scores highly is not necessarily working - it may simply not be asking
            anything.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScenarioOutcomes rows={perScenario} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cohort ATT&amp;CK coverage</CardTitle>
          <CardDescription>
            Techniques exercised by at least one student here. Gaps are a curriculum planning tool,
            not a criticism.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttackHeatmap
            tactics={listMitreTactics()}
            techniques={listMitreTechniques()}
            highlighted={[...covered]}
            scope="library"
          />
        </CardContent>
      </Card>
    </div>
  );
}
