import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AttackHeatmap } from "@/components/mitre/attack-heatmap";
import {
  getAttackDataVersion,
  listMitreTactics,
  listMitreTechniques,
  listScenarios,
} from "@/lib/content/loader";

export const metadata: Metadata = {
  title: "MITRE ATT&CK coverage",
  description:
    "Which ATT&CK techniques the NocturneAnalysis scenario library teaches, shown as a coverage heatmap, plus a plain reference for every technique in use.",
};

export default function MitrePage() {
  const techniques = listMitreTechniques();
  const tactics = listMitreTactics();
  const scenarios = listScenarios();
  const version = getAttackDataVersion();

  const taught = new Set(scenarios.flatMap((s) => s.scenario.mitre_techniques));

  const scenariosByTechnique = new Map<string, string[]>();
  for (const { scenario } of scenarios) {
    for (const id of scenario.mitre_techniques) {
      scenariosByTechnique.set(id, [...(scenariosByTechnique.get(id) ?? []), scenario.title]);
    }
  }

  const taughtTechniques = techniques
    .filter((t) => taught.has(t.technique_id))
    .sort((a, b) => a.technique_id.localeCompare(b.technique_id));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">MITRE ATT&amp;CK coverage</h1>
        <p className="mt-3 text-muted-foreground">
          ATT&amp;CK is a catalogue of what attackers actually do, organised by the goal they are
          pursuing at each step. Tactics are the goals &mdash; get in, run code, stay resident,
          steal credentials. Techniques are the specific ways of achieving them.
        </p>
        <p className="mt-3 text-muted-foreground">
          Below is what this platform teaches. Shaded cells are techniques a student will exercise
          in at least one scenario; the rest are in the reference set so the technique picker offers
          a realistic field of options rather than only the right answers.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Generated offline from ATT&amp;CK Enterprise v{version.attack_version} and bundled with
          the application. Nothing here is fetched at runtime, so it works identically on a school
          network that blocks external requests.
        </p>
      </header>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Library coverage</CardTitle>
            <CardDescription>
              {taught.size} techniques taught across {scenarios.length}{" "}
              {scenarios.length === 1 ? "scenario" : "scenarios"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AttackHeatmap
              tactics={tactics}
              techniques={techniques}
              highlighted={[...taught]}
              scope="library"
            />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Techniques in the curriculum</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Each of these is tagged in the console and in the generated report wherever it appears.
        </p>

        <ul className="mt-5 space-y-3">
          {taughtTechniques.map((technique) => (
            <li key={technique.technique_id} id={technique.technique_id}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {technique.technique_id}
                    </Badge>
                    <CardTitle className="text-base">{technique.name}</CardTitle>
                    {technique.tactics.map((tactic) => (
                      <Badge key={tactic} variant="secondary" className="text-[0.625rem]">
                        {tactic}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{technique.description}</p>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Exercised in:</span>
                    {(scenariosByTechnique.get(technique.technique_id) ?? []).map((title) => (
                      <Badge key={title} variant="default">
                        {title}
                      </Badge>
                    ))}
                  </div>

                  <a
                    href={technique.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                  >
                    Read the full entry on attack.mitre.org
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
        MITRE ATT&amp;CK&reg; and ATT&amp;CK&reg; are registered trademarks of The MITRE
        Corporation. Technique descriptions are reproduced from the ATT&amp;CK knowledge base under
        the ATT&amp;CK Terms of Use. The MITRE Corporation does not endorse this product. See also
        the{" "}
        <Link href="/owasp" className="text-primary underline underline-offset-2">
          OWASP Top 10 reference
        </Link>
        .
      </p>
    </div>
  );
}
