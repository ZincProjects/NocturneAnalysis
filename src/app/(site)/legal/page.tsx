import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { AlertTriangle, FileText } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Markdown } from "@/components/shared/markdown";

export const metadata: Metadata = {
  title: "Licensing",
  description:
    "NocturneAnalysis is source-available under PolyForm Noncommercial 1.0.0. Commercial licensing terms, third-party notices and attributions.",
};

/**
 * Renders the licensing documents from the repository rather than duplicating
 * them, so the page and the files cannot drift apart. HTML comments in the
 * source are stripped: they are drafting notes for whoever maintains the
 * files, not content for a visitor.
 */
function readDoc(file: string): string {
  const full = path.join(process.cwd(), file);
  if (!fs.existsSync(full)) return `_${file} is missing from the repository._`;
  return fs.readFileSync(full, "utf8").replace(/<!--[\s\S]*?-->/g, "").trim();
}

export default function LegalPage() {
  const license = readDoc("LICENSE.md");
  const commercial = readDoc("COMMERCIAL-LICENSE.md");
  const notice = readDoc("NOTICE");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Licensing</h1>
        <p className="mt-3 text-muted-foreground">
          NocturneAnalysis is source-available, not open source. You may read, run, modify and
          self-host it for noncommercial purposes; commercial use requires a separate licence.
        </p>
      </header>

      <Card className="mt-6 border-chart-3/40 bg-chart-3/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-chart-3" aria-hidden />
            Not legal advice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            These documents are a starting point chosen to match the intended business model. They
            have not been reviewed by a lawyer, several placeholders are unfilled, and no pricing
            has been set.
          </p>
          <p>
            Before pitching, signing anything, or accepting money from an institution, have a
            qualified lawyer in the relevant jurisdiction review them together. Singapore&apos;s
            PDPA also applies to the personal data this platform processes, and a significant share
            of its users are minors.
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="license" className="mt-8">
        <TabsList>
          <TabsTrigger value="license">
            <FileText className="mr-1.5 size-3.5" />
            License
          </TabsTrigger>
          <TabsTrigger value="commercial">Commercial</TabsTrigger>
          <TabsTrigger value="notice">Attributions</TabsTrigger>
        </TabsList>

        <TabsContent value="license">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">PolyForm Noncommercial 1.0.0</CardTitle>
              <CardDescription>
                The full text as published by the PolyForm Project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Markdown>{license}</Markdown>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commercial">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Commercial licensing</CardTitle>
              <CardDescription>
                When a paid licence is required, and the proposed tiers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Markdown>{commercial}</Markdown>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notice">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Third-party notices</CardTitle>
              <CardDescription>
                MITRE ATT&amp;CK, the OWASP Top 10, NIST SP 800-61 and bundled open-source
                dependencies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="scrollbar-thin overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-4 font-mono text-xs">
                {notice}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="mt-8 text-sm text-muted-foreground">
        Evaluating NocturneAnalysis, and running it for a single class within your own teaching, is
        free. See{" "}
        <Link href="/for-schools" className="text-primary underline underline-offset-2">
          For schools
        </Link>{" "}
        for what that covers.
      </p>
    </div>
  );
}
