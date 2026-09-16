import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveClassFeed } from "@/components/admin/live-class-feed";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listScenarios } from "@/lib/content/loader";
import { formatDuration } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Class dashboard",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const viewer = await requireStaff();
  const supabase = await createClient();

  const [{ data: sessions }, { data: profiles }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, scenario_id, user_id, status, current_phase, score, max_score, started_at, completed_at")
      .eq("org_id", viewer.profile.org_id)
      .order("started_at", { ascending: false })
      .limit(300),
    supabase
      .from("profiles")
      .select("id, handle, cohort, role")
      .eq("org_id", viewer.profile.org_id),
  ]);

  const { data: scenarioRows } = await supabase.from("scenarios").select("id, slug, title");

  const scenarioById = new Map((scenarioRows ?? []).map((s) => [s.id, s]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const bundleBySlug = new Map(listScenarios().map((b) => [b.scenario.slug, b]));

  const all = (sessions ?? []).map((s) => {
    const scenario = scenarioById.get(s.scenario_id);
    return {
      ...s,
      scenarioTitle: scenario?.title ?? "Unknown scenario",
      scenarioSlug: scenario?.slug,
      handle: profileById.get(s.user_id)?.handle ?? "unknown",
      cohort: profileById.get(s.user_id)?.cohort ?? null,
    };
  });

  const active = all.filter((s) => s.status === "in_progress");
  const finished = all.filter((s) => s.status !== "in_progress");

  const students = (profiles ?? []).filter((p) => p.role === "student");
  const scored = finished.filter((s) => s.score !== null && s.max_score);
  const averagePercent =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, s) => sum + (s.score ?? 0) / (s.max_score ?? 1), 0) / scored.length) *
            100,
        )
      : null;

  const containTimes = finished
    .filter((s) => s.completed_at)
    .map((s) => Date.parse(s.completed_at!) - Date.parse(s.started_at));
  const medianDuration =
    containTimes.length > 0
      ? containTimes.sort((a, b) => a - b)[Math.floor(containTimes.length / 2)]
      : null;

  // Which techniques the cohort has actually exercised, across finished work.
  const coveredTechniques = new Set(
    finished.flatMap((s) =>
      s.scenarioSlug ? (bundleBySlug.get(s.scenarioSlug)?.scenario.mitre_techniques ?? []) : [],
    ),
  );
  const libraryTechniques = new Set(
    listScenarios().flatMap((b) => b.scenario.mitre_techniques),
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Students", value: String(students.length) },
          { label: "Working now", value: String(active.length) },
          { label: "Completed incidents", value: String(finished.length) },
          { label: "Average score", value: averagePercent === null ? "—" : `${averagePercent}%` },
          {
            label: "Median time on incident",
            value: medianDuration === null ? "—" : formatDuration(medianDuration),
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live class view</CardTitle>
            <CardDescription>
              Who is in which phase right now. Updates as students work, without a page refresh.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LiveClassFeed
              orgId={viewer.profile.org_id}
              initial={active.map((s) => ({
                id: s.id,
                handle: s.handle,
                cohort: s.cohort,
                scenarioTitle: s.scenarioTitle,
                phase: s.current_phase,
                startedAt: s.started_at,
              }))}
              scenarioTitles={Object.fromEntries(
                (scenarioRows ?? []).map((s) => [s.id, s.title]),
              )}
              handles={Object.fromEntries(
                (profiles ?? []).map((p) => [p.id, p.handle]),
              )}
            />
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent submissions
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/analytics">Cohort analytics</Link>
          </Button>
        </div>

        {finished.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No submissions yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Analyst</th>
                  <th className="py-2 pr-4 font-medium">Cohort</th>
                  <th className="py-2 pr-4 font-medium">Scenario</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Score</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {finished.slice(0, 40).map((session) => (
                  <tr key={session.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium">{session.handle}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{session.cohort ?? "—"}</td>
                    <td className="py-2 pr-4">{session.scenarioTitle}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={session.status === "graded" ? "success" : "secondary"}>
                        {session.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {session.score !== null ? `${session.score}/${session.max_score}` : "—"}
                    </td>
                    <td className="py-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/sessions/${session.id}`}>Review</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cohort ATT&amp;CK coverage</CardTitle>
            <CardDescription>
              {coveredTechniques.size} of {libraryTechniques.size} techniques in the library have
              been exercised by at least one student in this organisation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {[...libraryTechniques].sort().map((id) => (
                <Badge key={id} variant={coveredTechniques.has(id) ? "default" : "outline"}>
                  {id}
                </Badge>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Unfilled badges are techniques the library teaches that nobody here has reached yet -
              useful for deciding which scenario to assign next. Per-student coverage is on each
              student&apos;s own dashboard.
            </p>
          </CardContent>
        </Card>
      </section>

      <p className="text-xs text-muted-foreground">
        Scenario authoring is file-based for this release: scenarios live in <code>/content</code>{" "}
        and are loaded by <code>npm run db:apply</code>. A web authoring interface is a planned
        enhancement and is deliberately not built yet.
      </p>
    </div>
  );
}
