import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listOwaspCategories, listScenarios } from "@/lib/content/loader";

export const metadata: Metadata = {
  title: "OWASP Top 10 reference",
  description:
    "The OWASP Top 10 (2021) explained in plain language, with a worked example and concrete prevention for each category.",
};

export default function OwaspPage() {
  const categories = listOwaspCategories();
  const scenarios = listScenarios();

  const scenariosByCode = new Map<string, { slug: string; title: string }[]>();
  for (const { scenario } of scenarios) {
    for (const code of scenario.owasp_categories) {
      scenariosByCode.set(code, [
        ...(scenariosByCode.get(code) ?? []),
        { slug: scenario.slug, title: scenario.title },
      ]);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">OWASP Top 10 (2021)</h1>
        <p className="mt-3 text-muted-foreground">
          Where ATT&amp;CK catalogues what attackers do, the OWASP Top 10 catalogues what goes wrong
          in the applications they attack. It is the standard vocabulary for web application
          security, and a student who can name the category a bug belongs to can find the fix for it.
        </p>
        <p className="mt-3 text-muted-foreground">
          Categories are ordered by how often they show up in real applications, not by how
          dangerous any single instance is. A03 Injection is third on the list and still ends
          careers.
        </p>
      </header>

      <div className="mt-8 space-y-4">
        {categories.map((category) => {
          const used = scenariosByCode.get(category.code) ?? [];
          const anchor = category.code.replace(":", "-");

          return (
            <Card key={category.code} id={anchor} className="scroll-mt-20">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {category.code}
                  </Badge>
                  <CardTitle className="text-lg">{category.short_name}</CardTitle>
                  {used.length > 0 ? (
                    <Badge variant="default" className="gap-1">
                      <ShieldAlert className="size-3" />
                      In the curriculum
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm">{category.plain_language}</p>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    What it looks like
                  </h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{category.example}</p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    How it is prevented
                  </h3>
                  <ul className="mt-1.5 space-y-1">
                    {category.prevention.map((item) => (
                      <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                        <span aria-hidden>&middot;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {used.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs">
                    <span className="text-muted-foreground">Exercised in:</span>
                    {used.map((scenario) => (
                      <Link
                        key={scenario.slug}
                        href={`/scenarios/${scenario.slug}/briefing`}
                        className="text-primary underline underline-offset-2"
                      >
                        {scenario.title}
                      </Link>
                    ))}
                  </div>
                ) : null}

                <a
                  href={category.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2"
                >
                  Read the full OWASP entry
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
        OWASP&reg; and the OWASP Top 10 are trademarks of the OWASP Foundation. The Top 10 is
        published under CC BY-SA 4.0; the plain-language explanations, examples and prevention notes
        on this page are original and written for this platform. The OWASP Foundation does not
        endorse this product. See also the{" "}
        <Link href="/mitre" className="text-primary underline underline-offset-2">
          ATT&amp;CK coverage map
        </Link>
        .
      </p>
    </div>
  );
}
