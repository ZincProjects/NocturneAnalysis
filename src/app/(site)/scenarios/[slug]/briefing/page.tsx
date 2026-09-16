import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ListChecks, Play, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/components/shared/markdown";
import { DifficultyChip, OwaspChip, TechniqueChip } from "@/components/shared/chips";
import { SyntheticDataNotice } from "@/components/layout/synthetic-data-notice";
import { StartSessionButton } from "@/components/console/start-session-button";
import {
  getMitreTechnique,
  getOwaspCategory,
  getScenarioBundle,
  listScenarios,
} from "@/lib/content/loader";
import { getViewer } from "@/lib/auth/session";
import { PHASE_LABELS, PHASE_NIST_MAPPING } from "@/lib/events/types";

export function generateStaticParams() {
  return listScenarios().map(({ scenario }) => ({ slug: scenario.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bundle = getScenarioBundle(slug);
  if (!bundle) return { title: "Scenario not found" };
  return {
    title: bundle.scenario.title,
    description: bundle.scenario.summary,
  };
}

export default async function BriefingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const bundle = getScenarioBundle(slug);
  if (!bundle) notFound();

  const { scenario } = bundle;
  const viewer = await getViewer();

  const continuation = scenario.continues_from
    ? getScenarioBundle(scenario.continues_from)
    : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary" className="capitalize">
          {scenario.category}
        </Badge>
        <DifficultyChip difficulty={scenario.difficulty} />
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3" aria-hidden />~{scenario.estimated_minutes} minutes
        </span>
      </div>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{scenario.title}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{scenario.summary}</p>

      {continuation ? (
        <p className="mt-4 rounded-md border border-border bg-secondary/40 p-3 text-sm">
          This incident continues{" "}
          <Link
            href={`/scenarios/${continuation.scenario.slug}/briefing`}
            className="text-primary underline underline-offset-2"
          >
            {continuation.scenario.title}
          </Link>
          . You can work it on its own, but running them back to back shows how one unremediated
          mailbox becomes an estate-wide event.
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Briefing</CardTitle>
            </CardHeader>
            <CardContent>
              <Markdown>{scenario.briefing_md}</Markdown>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="size-4 text-primary" aria-hidden />
                What you will be asked to do
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {scenario.phases.map((phase, index) => (
                  <li key={phase.key} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-xs text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{PHASE_LABELS[phase.key]}</p>
                      <p className="text-xs text-muted-foreground">
                        {phase.objectives[0] ?? phase.title}
                      </p>
                      <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                        NIST SP 800-61: {PHASE_NIST_MAPPING[phase.key]}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <SyntheticDataNotice variant="card" />
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="size-4 text-primary" aria-hidden />
                Frameworks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {scenario.mitre_techniques.map((id) => (
                  <TechniqueChip key={id} id={id} technique={getMitreTechnique(id)} />
                ))}
              </div>
              {scenario.owasp_categories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 border-t border-border pt-3">
                  {scenario.owasp_categories.map((code) => (
                    <OwaspChip key={code} code={code} category={getOwaspCategory(code)} />
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Learning objectives</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {scenario.learning_objectives.map((objective) => (
                  <li key={objective} className="flex gap-2 text-xs text-muted-foreground">
                    <span aria-hidden>&middot;</span>
                    {objective}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="sticky top-20">
            {viewer ? (
              <StartSessionButton slug={scenario.slug} />
            ) : (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <p className="text-sm text-muted-foreground">
                    Sign in to work this incident. Your instructor issues accounts.
                  </p>
                  <Button asChild className="w-full">
                    <Link href={`/login?next=/scenarios/${scenario.slug}/briefing`}>
                      <Play className="size-4" />
                      Sign in to start
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="w-full">
                    <Link href="/samples">See a finished report instead</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
