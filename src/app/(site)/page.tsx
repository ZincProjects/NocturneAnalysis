import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileCheck2,
  Fingerprint,
  Link2,
  Radar,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SyntheticDataNotice } from "@/components/layout/synthetic-data-notice";
import { DifficultyChip } from "@/components/shared/chips";
import { getAttackDataVersion, listScenarios } from "@/lib/content/loader";
import { PHASE_KEYS, PHASE_LABELS, PHASE_NIST_MAPPING } from "@/lib/events/types";

export default function HomePage() {
  const scenarios = listScenarios();
  const attack = getAttackDataVersion();
  const techniqueCount = new Set(scenarios.flatMap((s) => s.scenario.mitre_techniques)).size;

  return (
    <div className="mx-auto w-full max-w-7xl px-4">
      {/* ------------------------------------------------------------ hero */}
      <section className="py-16 sm:py-24">
        <Badge variant="outline" className="mb-6">
          <Radar className="size-3" />
          Built for cybersecurity electives, CTF clubs and IT diploma programmes
        </Badge>

        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Teach students what a SOC shift actually feels like.
        </h1>

        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          NocturneAnalysis puts a student in front of a realistic alert queue and asks them to work
          an incident the way an analyst does &mdash; triage it, investigate it, contain it,
          eradicate it, recover from it, and write the report at the end. Every action they take is
          timestamped into a tamper-evident log that becomes their submitted incident report.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/scenarios">
              Browse the scenario library
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/samples">See a generated report</Link>
          </Button>
          <Button size="lg" variant="ghost" asChild>
            <Link href="/for-schools">For schools and polytechnics</Link>
          </Button>
        </div>

        <dl className="mt-12 grid grid-cols-2 gap-6 border-t border-border pt-8 sm:grid-cols-4">
          {[
            { label: "Scenarios", value: String(scenarios.length) },
            { label: "IR phases per incident", value: "6" },
            { label: "ATT&CK techniques mapped", value: String(techniqueCount) },
            { label: "Real external traffic", value: "None" },
          ].map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* --------------------------------------------------------- the arc */}
      <section className="border-t border-border py-14">
        <h2 className="text-2xl font-semibold tracking-tight">The whole lifecycle, not just the catch</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Most training stops at &ldquo;spot the malware.&rdquo; Real incident response is mostly what
          happens afterwards. Each phase is gated: a student cannot move on until the minimum work
          for that phase is genuinely done.
        </p>

        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PHASE_KEYS.map((phase, index) => (
            <li key={phase}>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 font-mono text-xs text-primary">
                      {index + 1}
                    </span>
                    <CardTitle className="text-base">{PHASE_LABELS[phase]}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    NIST SP 800-61: {PHASE_NIST_MAPPING[phase]}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------- what's in */}
      <section className="border-t border-border py-14">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Fingerprint,
              title: "Evidence you can actually defend",
              body: "Every meaningful action becomes one immutable, server-timestamped row in a SHA-256 hash chain. No role can edit or delete it - not students, not instructors, not administrators. Instructors verify a session's integrity with one click.",
            },
            {
              icon: Target,
              title: "Framework-mapped throughout",
              body: `Techniques are tagged against MITRE ATT&CK v${attack.attack_version} in the console and the report, and web scenarios additionally carry their OWASP Top 10 categories. A heatmap shows what the library covers and what a student has personally exercised.`,
            },
            {
              icon: ClipboardList,
              title: "Noise, decoys and false positives",
              body: "Alert queues contain things that do not matter. Log sets contain benign values that look alarming. Tagging the school's own CDN as an indicator costs points, because in a real SOC it costs an outage.",
            },
            {
              icon: FileCheck2,
              title: "A report at the end, every time",
              body: "The lessons-learned write-up is mandatory. Submission assembles an incident report - timeline, IOC table, techniques matched versus missed, score breakdown - exported as PDF and Markdown.",
            },
            {
              icon: Link2,
              title: "Connected campaigns",
              body: "Scenarios can continue one another. The ransomware outbreak reuses the phishing scenario's patient zero, so a class can run them back to back and see how one unremediated mailbox becomes an estate-wide event.",
            },
            {
              icon: Radar,
              title: "Works on school hardware",
              body: "Browser-only, responsive down to a Chromebook, fully keyboard-navigable, with a light theme for projectors. Reference data is bundled, so a demo on bad wifi behaves exactly like a demo on good wifi.",
            },
          ].map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <feature.icon className="size-5 text-primary" aria-hidden />
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.body}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- scenarios */}
      <section className="border-t border-border py-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">Scenario library</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/scenarios">
              All scenarios
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {scenarios.map(({ scenario }) => (
            <Card key={scenario.slug}>
              <CardHeader>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="capitalize">
                    {scenario.category}
                  </Badge>
                  <DifficultyChip difficulty={scenario.difficulty} />
                  <span className="text-muted-foreground">
                    ~{scenario.estimated_minutes} min
                  </span>
                </div>
                <CardTitle className="mt-1 text-base">
                  <Link href={`/scenarios/${scenario.slug}/briefing`} className="hover:underline">
                    {scenario.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{scenario.summary}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-border py-14">
        <SyntheticDataNotice variant="card" />
      </section>
    </div>
  );
}
