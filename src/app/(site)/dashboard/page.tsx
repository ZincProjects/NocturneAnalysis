import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Award, GraduationCap, Play, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DifficultyChip } from "@/components/shared/chips";
import { AttackHeatmap } from "@/components/mitre/attack-heatmap";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listMitreTactics, listMitreTechniques, listScenarios } from "@/lib/content/loader";
import { BADGE_DEFINITIONS } from "@/lib/grading/engine";
import { PHASE_LABELS } from "@/lib/events/types";
import { formatUtc } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/dashboard");

  const supabase = await createClient();
  const scenarios = listScenarios();

  const [{ data: sessions }, { data: badgeRows }, { data: assignments }, { data: onboarding }] =
    await Promise.all([
      supabase
        .from("sessions")
        .select("id, scenario_id, status, current_phase, score, max_score, started_at, completed_at")
        .eq("user_id", viewer.userId)
        .order("started_at", { ascending: false }),
      supabase.from("session_badges").select("badge_id, badges(key, name, description)"),
      supabase
        .from("assignments")
        .select("id, scenario_id, due_at, cohort")
        .eq("org_id", viewer.profile.org_id),
      supabase
        .from("onboarding_results")
        .select("score, max_score, completed_at")
        .eq("user_id", viewer.userId)
        .maybeSingle(),
    ]);

  const { data: scenarioRows } = await supabase.from("scenarios").select("id, slug, title");
  const slugById = new Map((scenarioRows ?? []).map((s) => [s.id, s.slug]));
  const bundleBySlug = new Map(scenarios.map((b) => [b.scenario.slug, b]));

  const mySessions = (sessions ?? []).map((session) => {
    const slug = slugById.get(session.scenario_id);
    return { ...session, slug, bundle: slug ? bundleBySlug.get(slug) : undefined };
  });

  const inProgress = mySessions.filter((s) => s.status === "in_progress");
  const finished = mySessions.filter((s) => s.status !== "in_progress");

  const completedSlugs = new Set(finished.map((s) => s.slug).filter(Boolean) as string[]);
  const notStarted = scenarios.filter(
    ({ scenario }) =>
      !mySessions.some((s) => s.slug === scenario.slug),
  );

  // Cumulative ATT&CK coverage: techniques from every scenario this student
  // has actually finished, not every scenario they have opened.
  const coveredTechniques = new Set(
    finished.flatMap((s) => s.bundle?.scenario.mitre_techniques ?? []),
  );

  const earnedBadgeKeys = new Set(
    (badgeRows ?? [])
      .map((row) => (row.badges as unknown as { key: string } | null)?.key)
      .filter(Boolean) as string[],
  );

  const assignedSlugs = new Set(
    (assignments ?? []).map((a) => slugById.get(a.scenario_id)).filter(Boolean) as string[],
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {viewer.profile.handle}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {viewer.org.name}
            {viewer.profile.cohort ? ` · ${viewer.profile.cohort}` : ""}
          </p>
        </div>

        {!viewer.profile.onboarding_completed_at ? (
          <Button asChild>
            <Link href="/onboarding">
              <GraduationCap className="size-4" />
              Start SOC 101
            </Link>
          </Button>
        ) : null}
      </header>

      {/* --------------------------------------------------- in progress */}
      {inProgress.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pick up where you left off
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {inProgress.map((session) => (
              <Card key={session.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {session.bundle?.scenario.title ?? "Unknown scenario"}
                  </CardTitle>
                  <CardDescription>
                    Currently in {PHASE_LABELS[session.current_phase]} &middot; started{" "}
                    {formatUtc(session.started_at).slice(0, 16)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link href={`/console/${session.id}`}>
                      <Play className="size-4" />
                      Resume the incident
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------ assigned */}
      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Scenarios
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/scenarios">
              Browse all
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notStarted.map(({ scenario }) => (
            <Card key={scenario.slug}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary" className="capitalize">
                    {scenario.category}
                  </Badge>
                  <DifficultyChip difficulty={scenario.difficulty} />
                  {assignedSlugs.has(scenario.slug) ? (
                    <Badge variant="default">Assigned</Badge>
                  ) : null}
                </div>
                <CardTitle className="mt-1 text-base">{scenario.title}</CardTitle>
                <CardDescription>{scenario.summary}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild className="w-full">
                  <Link href={`/scenarios/${scenario.slug}/briefing`}>Read the briefing</Link>
                </Button>
              </CardContent>
            </Card>
          ))}

          {notStarted.length === 0 && inProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have worked every scenario in the library. More are on the way.
            </p>
          ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------ finished */}
      {finished.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Completed incidents
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Scenario</th>
                  <th className="py-2 pr-4 font-medium">Completed</th>
                  <th className="py-2 pr-4 font-medium">Score</th>
                  <th className="py-2 font-medium">Report</th>
                </tr>
              </thead>
              <tbody>
                {finished.map((session) => (
                  <tr key={session.id} className="border-b border-border/60">
                    <td className="py-2 pr-4">{session.bundle?.scenario.title ?? "-"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {session.completed_at ? formatUtc(session.completed_at).slice(0, 16) : "-"}
                    </td>
                    <td className="py-2 pr-4 tabular-nums">
                      {session.score !== null ? `${session.score} / ${session.max_score}` : "-"}
                    </td>
                    <td className="py-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/console/${session.id}/report`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------ coverage */}
      <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="size-4 text-primary" aria-hidden />
              Your ATT&amp;CK coverage
            </CardTitle>
            <CardDescription>
              Techniques exercised across the incidents you have completed. Shaded cells are ones
              you have worked; the rest are what the library still has to teach you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttackHeatmap
              tactics={listMitreTactics()}
              techniques={listMitreTechniques()}
              highlighted={[...coveredTechniques]}
              scope="student"
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="size-4 text-primary" aria-hidden />
                Badges
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {BADGE_DEFINITIONS.map((badge) => {
                const earned = earnedBadgeKeys.has(badge.key);
                return (
                  <div
                    key={badge.key}
                    className={`rounded-md border p-2.5 ${earned ? "border-chart-5/40 bg-chart-5/5" : "border-border opacity-60"}`}
                  >
                    <p className="text-sm font-medium">{badge.name}</p>
                    <p className="text-xs text-muted-foreground">{badge.description}</p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">SOC 101</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {onboarding ? (
                <>
                  <p className="text-sm">
                    Comprehension check: {onboarding.score} / {onboarding.max_score}
                  </p>
                  <Progress value={(onboarding.score / onboarding.max_score) * 100} />
                  <Button variant="ghost" size="sm" asChild className="w-full">
                    <Link href="/onboarding">Review the primer</Link>
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    A short primer on what a SOC does, how escalation works and why evidence
                    integrity matters. Fifteen minutes, and it makes the first scenario land.
                  </p>
                  <Button asChild className="w-full">
                    <Link href="/onboarding">Start SOC 101</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <p className="sr-only">{completedSlugs.size} scenarios completed.</p>
    </div>
  );
}
