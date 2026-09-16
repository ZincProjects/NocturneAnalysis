import type { Metadata } from "next";
import Link from "next/link";
import {
  Accessibility,
  ArrowRight,
  ClipboardCheck,
  FileText,
  Fingerprint,
  Lock,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SyntheticDataNotice } from "@/components/layout/synthetic-data-notice";
import { DifficultyChip } from "@/components/shared/chips";
import { getAttackDataVersion, listScenarios } from "@/lib/content/loader";
import { listSampleSessions } from "@/lib/content/samples";
import { PHASE_KEYS, PHASE_LABELS, PHASE_NIST_MAPPING } from "@/lib/events/types";

export const metadata: Metadata = {
  title: "For schools and polytechnics",
  description:
    "What NocturneAnalysis is, why it is safe to run on a school network, how it maps to MITRE ATT&CK and the OWASP Top 10, and what it costs.",
};

export default function ForSchoolsPage() {
  const scenarios = listScenarios();
  const samples = listSampleSessions();
  const attack = getAttackDataVersion();
  const techniqueCount = new Set(scenarios.flatMap((s) => s.scenario.mitre_techniques)).size;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12">
      <header className="max-w-3xl">
        <Badge variant="outline" className="mb-4">
          For educators, heads of department and IT
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          NocturneAnalysis for schools and polytechnics
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          A browser-based SOC analyst training platform. Students work realistic, entirely synthetic
          security incidents through the full professional incident response lifecycle and produce a
          report at the end.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/samples">
              <FileText className="size-4" />
              Read a sample report
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/scenarios">Browse the scenario library</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/mitre">See ATT&amp;CK coverage</Link>
          </Button>
        </div>
      </header>

      {/* ---------------------------------------------------------- safety */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          The answer your IT department will want first
        </h2>
        <div className="mt-4">
          <SyntheticDataNotice variant="card" />
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="size-4 text-primary" aria-hidden />
              This is a build step, not a promise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Every content file is scanned before it can ship. If any address or hostname in a
              scenario could refer to real infrastructure, the build fails. Addresses must fall in
              the IETF documentation ranges or private space; hostnames must use reserved TLDs that
              cannot resolve.
            </p>
            <p>
              The check lives in the repository at{" "}
              <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                src/lib/content/safety.ts
              </code>{" "}
              and you are welcome to read it.
            </p>
            <p>
              Nothing in the platform teaches or performs an attack against a real system. Students
              analyse evidence and make response decisions. There is no exploit tooling, no payload
              delivery, and no capability that could be turned outward.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ------------------------------------------------------- lifecycle */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">The whole lifecycle</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Most training stops at spotting the malware. Each phase here is gated &mdash; a student
          cannot advance until the minimum work is genuinely done &mdash; and the post-incident
          review is mandatory.
        </p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PHASE_KEYS.map((phase, i) => (
            <li key={phase} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">
                {i + 1}. {PHASE_LABELS[phase]}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                NIST SP 800-61: {PHASE_NIST_MAPPING[phase]}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------- scenarios */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">
          {scenarios.length} scenarios at launch
        </h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Scenario</th>
                <th className="py-2 pr-4 font-medium">Class</th>
                <th className="py-2 pr-4 font-medium">Level</th>
                <th className="py-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map(({ scenario }) => (
                <tr key={scenario.slug} className="border-b border-border/60">
                  <td className="py-2 pr-4">
                    <Link
                      href={`/scenarios/${scenario.slug}/briefing`}
                      className="font-medium hover:underline"
                    >
                      {scenario.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 capitalize text-muted-foreground">
                    {scenario.category}
                  </td>
                  <td className="py-2 pr-4">
                    <DifficultyChip difficulty={scenario.difficulty} />
                  </td>
                  <td className="py-2 text-muted-foreground">~{scenario.estimated_minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          The ransomware scenario continues the phishing one. Assigned back to back, a class sees
          how an incident closed without proper eradication becomes an estate-wide event a week
          later &mdash; a lesson that lands far harder as an experience than as a slide.
        </p>
      </section>

      {/* -------------------------------------------------- the three cards */}
      <section className="mt-12 grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader>
            <Target className="size-5 text-primary" aria-hidden />
            <CardTitle className="text-base">Curriculum fit you can check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              {techniqueCount} MITRE ATT&amp;CK techniques (v{attack.attack_version}) across the
              library, tagged in the console and the report. The web scenario additionally carries
              its OWASP Top 10 mapping.
            </p>
            <p>
              A coverage heatmap shows exactly what is taught, so you can check syllabus fit before
              committing rather than after.
            </p>
            <Button variant="link" className="h-auto p-0" asChild>
              <Link href="/mitre">
                Coverage map
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Fingerprint className="size-5 text-primary" aria-hidden />
            <CardTitle className="text-base">Assessment you can defend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Every action becomes one immutable, server-timestamped row in a SHA-256 hash chain.
              No role can edit or delete it &mdash; not students, not instructors, not
              administrators. It is enforced by database triggers, not application code.
            </p>
            <p>
              Integrity verifies in one click. The raw log exports for external moderation. Grading
              is rule-based, and any instructor adjustment is recorded as a new event rather than an
              edit.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Lock className="size-5 text-primary" aria-hidden />
            <CardTitle className="text-base">Built for minors&apos; data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Students are pseudonymous by default; handles are the only name on leaderboards or in
              reports. Leaderboards are off unless you switch them on.
            </p>
            <p>
              Minimal collection, row-level tenant isolation, and an audited erasure path that
              honours a withdrawal of consent while retaining proof it happened.
            </p>
            <p className="text-xs">
              Singapore&apos;s PDPA applies. The platform supplies the controls; the retention
              policy and processor agreement are decisions for your institution and us together.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ---------------------------------------------------- accessibility */}
      <section className="mt-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Accessibility className="size-4 text-primary" aria-hidden />
              Accessibility and hardware
            </CardTitle>
            <CardDescription>
              It has to work on the machines you actually have.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {[
                "Runs in a browser. Nothing to install on a lab machine.",
                "Responsive down to a Chromebook screen; the console reflows to tabs.",
                "Keyboard-navigable throughout, with visible focus indicators.",
                "Severity is carried by colour and by text, never colour alone.",
                "Dark and light themes - the light one exists for projectors.",
                "Reference data is bundled, so a demo on throttled wifi behaves normally.",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden>&middot;</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              Built to WCAG 2.1 AA. It has <strong>not</strong> been independently audited, and we
              would rather tell you that than claim conformance we cannot evidence.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* --------------------------------------------------------- pricing */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">Licensing</h2>
        <p className="mt-3 text-muted-foreground">
          Source-available, not open source. Evaluating it, and running it for a single class within
          your own teaching, is free and always will be.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              name: "Free Classroom Trial",
              price: "Free",
              scope: "One cohort, one instructor",
              points: ["Full scenario library", "Reports and instructor console", "Community support"],
            },
            {
              name: "Single Educator",
              price: "[TBD] / year",
              scope: "One instructor and their classes",
              points: ["Everything in the trial", "Scenario updates for the term", "Email support"],
            },
            {
              name: "Institution-Wide",
              price: "[TBD] / year",
              scope: "Unlimited staff and students",
              points: ["SSO integration", "Cohort analytics", "Onboarding session"],
            },
          ].map((tier) => (
            <Card key={tier.name}>
              <CardHeader>
                <CardTitle className="text-base">{tier.name}</CardTitle>
                <p className="text-2xl font-semibold tabular-nums">{tier.price}</p>
                <CardDescription>{tier.scope}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-muted-foreground">
                  {tier.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden>&middot;</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-4 rounded-md border border-chart-3/40 bg-chart-3/5 p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Pricing is not yet set.</strong> The figures above are
          placeholders pending legal and commercial review. Nothing on this page is legal advice.
          See{" "}
          <Link href="/legal" className="text-primary underline underline-offset-2">
            licensing
          </Link>{" "}
          for the full terms.
        </p>
      </section>

      {/* ---------------------------------------------------------- see it */}
      <section className="mt-12 rounded-lg border border-border p-6">
        <h2 className="text-xl font-semibold tracking-tight">
          See it without talking to anyone
        </h2>
        <p className="mt-2 text-muted-foreground">
          {samples.length} complete sample reports are published, no account required. They are
          produced by the real grading and rendering pipeline from real session logs &mdash;
          including the missed indicators and the hints taken. Not mock-ups.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/samples">
              Sample reports
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/scenarios">Scenario library</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
