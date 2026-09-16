import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SyntheticDataNotice } from "@/components/layout/synthetic-data-notice";
import { DifficultyChip } from "@/components/shared/chips";
import { buildSampleReport, listSampleSessions } from "@/lib/content/samples";
import { getScenarioBundle } from "@/lib/content/loader";
import { formatDuration } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sample incident reports",
  description:
    "Complete incident reports produced by NocturneAnalysis, viewable without an account. Every figure is derived from a tamper-evident event log.",
};

export default async function SamplesPage() {
  const samples = listSampleSessions();

  const cards = await Promise.all(
    samples.map(async (sample) => {
      const model = await buildSampleReport(sample.scenario_slug);
      const bundle = getScenarioBundle(sample.scenario_slug);
      return { sample, model, bundle };
    }),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Sample incident reports</h1>
        <p className="mt-3 text-muted-foreground">
          These are real reports, not mock-ups. Each one was produced by replaying a complete
          session through the same grading and rendering pipeline a student&apos;s submission goes
          through, so what you see here is exactly what your students will produce &mdash; including
          the missed indicators and the hint they took.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          No account needed. Every page below is public.
        </p>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {cards.map(({ sample, model, bundle }) => {
          if (!model || !bundle) return null;
          const g = model.grade;

          return (
            <Card key={sample.scenario_slug} className="flex flex-col">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary" className="capitalize">
                    {bundle.scenario.category}
                  </Badge>
                  <DifficultyChip difficulty={bundle.scenario.difficulty} />
                  <Badge variant="outline" className="gap-1">
                    <ShieldCheck className="size-3" />
                    {model.integrity.valid ? "Chain verified" : "Chain broken"}
                  </Badge>
                </div>
                <CardTitle className="mt-1 text-lg">{bundle.scenario.title}</CardTitle>
                <CardDescription>{bundle.scenario.summary}</CardDescription>
              </CardHeader>

              <CardContent className="mt-auto space-y-4">
                <dl className="grid grid-cols-2 gap-3 border-y border-border py-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Score</dt>
                    <dd className="font-medium tabular-nums">
                      {g.score}/{g.max_score}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Techniques</dt>
                    <dd className="font-medium tabular-nums">
                      {g.mitre.matched.length}/{model.techniques.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Duration</dt>
                    <dd className="font-medium tabular-nums">
                      {formatDuration(model.duration_ms)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Events</dt>
                    <dd className="font-medium tabular-nums">{model.event_count}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/samples/${sample.scenario_slug}`}>
                      <FileText className="size-4" />
                      Read the report
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={`/samples/${sample.scenario_slug}/report.pdf`}>Download PDF</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href={`/scenarios/${sample.scenario_slug}/briefing`}>
                      See the scenario
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {cards.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No samples have been generated yet. Run <code>npm run samples:build</code>.
        </p>
      ) : null}

      <div className="mt-10">
        <SyntheticDataNotice variant="card" />
      </div>
    </div>
  );
}
