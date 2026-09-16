import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DifficultyChip, OwaspChip, TechniqueChip } from "@/components/shared/chips";
import { SyntheticDataNotice } from "@/components/layout/synthetic-data-notice";
import { getOwaspCategory, getMitreTechnique, listScenarios } from "@/lib/content/loader";

export const metadata: Metadata = {
  title: "Scenario library",
  description:
    "Synthetic SOC incidents spanning phishing, network intrusion, web application attacks and ransomware, each mapped to MITRE ATT&CK.",
};

const DIFFICULTY_ORDER = { beginner: 0, intermediate: 1, advanced: 2 } as const;

export default function ScenariosPage() {
  const scenarios = [...listScenarios()].sort(
    (a, b) =>
      DIFFICULTY_ORDER[a.scenario.difficulty] - DIFFICULTY_ORDER[b.scenario.difficulty] ||
      a.scenario.title.localeCompare(b.scenario.title),
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Scenario library</h1>
        <p className="mt-3 text-muted-foreground">
          Every scenario runs the full incident-response lifecycle, from the first alert to a
          submitted report with a lessons-learned section the student writes themselves. Each one is
          mapped to the ATT&amp;CK techniques it actually exercises, so a curriculum lead can see
          coverage rather than take it on trust.
        </p>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {scenarios.map(({ scenario }) => (
          <Card key={scenario.slug} className="flex flex-col">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary" className="capitalize">
                  {scenario.category}
                </Badge>
                <DifficultyChip difficulty={scenario.difficulty} />
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="size-3" aria-hidden />~{scenario.estimated_minutes} min
                </span>
                {scenario.continues_from ? (
                  <Badge variant="outline">Continues an earlier incident</Badge>
                ) : null}
              </div>

              <CardTitle className="mt-1 text-lg">
                <Link
                  href={`/scenarios/${scenario.slug}/briefing`}
                  className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  {scenario.title}
                </Link>
              </CardTitle>
              <CardDescription>{scenario.summary}</CardDescription>
            </CardHeader>

            <CardContent className="mt-auto space-y-4">
              <div>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Target className="size-3.5" aria-hidden />
                  Techniques exercised
                </h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {scenario.mitre_techniques.map((id) => (
                    <TechniqueChip key={id} id={id} technique={getMitreTechnique(id)} />
                  ))}
                  {scenario.owasp_categories.map((code) => (
                    <OwaspChip key={code} code={code} category={getOwaspCategory(code)} />
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Learning objectives
                </h3>
                <ul className="mt-2 space-y-1">
                  {scenario.learning_objectives.slice(0, 3).map((objective) => (
                    <li key={objective} className="flex gap-2 text-xs text-muted-foreground">
                      <span aria-hidden>&middot;</span>
                      {objective}
                    </li>
                  ))}
                  {scenario.learning_objectives.length > 3 ? (
                    <li className="pl-4 text-xs text-muted-foreground">
                      and {scenario.learning_objectives.length - 3} more
                    </li>
                  ) : null}
                </ul>
              </div>

              <Button asChild className="w-full">
                <Link href={`/scenarios/${scenario.slug}/briefing`}>Read the briefing</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <SyntheticDataNotice variant="card" />
      </div>
    </div>
  );
}
