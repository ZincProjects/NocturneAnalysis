import Link from "next/link";
import {
  Award,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  ShieldCheck,
  ShieldX,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Markdown } from "@/components/shared/markdown";
import { SyntheticDataNotice } from "@/components/layout/synthetic-data-notice";
import { shortHash } from "@/lib/events/hash";
import { PHASE_LABELS } from "@/lib/events/types";
import { BADGE_DEFINITIONS } from "@/lib/grading/engine";
import { cn, formatDuration, formatUtc } from "@/lib/utils";
import type { ReportModel } from "@/lib/report/build";

/**
 * The web rendering of a generated incident report.
 *
 * Used unchanged by three surfaces - a student reviewing their own submission,
 * an instructor marking it, and a prospective school browsing `/samples`
 * logged out - because they should all be looking at the same document. The
 * only thing that varies is the download links passed in.
 */
export function ReportView({
  model,
  downloads,
  showModelAnswers = true,
}: {
  model: ReportModel;
  downloads?: { markdown?: string; pdf?: string };
  showModelAnswers?: boolean;
}) {
  const g = model.grade;
  const badgeByKey = new Map(BADGE_DEFINITIONS.map((b) => [b.key, b]));

  return (
    <article className="space-y-8">
      {/* ------------------------------------------------------- header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary" className="capitalize">
            {model.scenario.category}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {model.scenario.difficulty}
          </Badge>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3" aria-hidden />
            {formatDuration(model.duration_ms)} on the incident
          </span>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Incident Report: {model.scenario.title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Prepared by <span className="font-medium text-foreground">{model.analyst_handle}</span>{" "}
            &middot; {model.organization_name} &middot; generated {formatUtc(model.generated_at)}
          </p>
        </div>

        {downloads ? (
          <div className="flex flex-wrap gap-2">
            {downloads.pdf ? (
              <Button asChild size="sm">
                <a href={downloads.pdf}>
                  <Download className="size-4" />
                  Download PDF
                </a>
              </Button>
            ) : null}
            {downloads.markdown ? (
              <Button asChild size="sm" variant="outline">
                <a href={downloads.markdown}>
                  <FileText className="size-4" />
                  Download Markdown
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      {/* --------------------------------------------------- score strip */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="sm:col-span-1">
          <CardHeader className="pb-2">
            <CardDescription>Score</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {g.score}
              <span className="text-base font-normal text-muted-foreground">/{g.max_score}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">{g.percentage}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Techniques identified</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {g.mitre.matched.length}
              <span className="text-base font-normal text-muted-foreground">
                /{model.techniques.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {g.mitre.false_positives.length > 0
                ? `${g.mitre.false_positives.length} claimed without evidence`
                : "No unsupported claims"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Indicators</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {model.iocs.filter((i) => i.status === "correct").length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {model.iocs.filter((i) => i.status === "missed").length} missed,{" "}
              {model.iocs.filter((i) => i.status === "false_positive").length} false positive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Time to containment</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {model.time_to_contain_ms === null
                ? "—"
                : formatDuration(model.time_to_contain_ms)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">From first alert to first containment</p>
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------- integrity */}
      <Card
        className={cn(
          model.integrity.valid ? "border-chart-5/40 bg-chart-5/5" : "border-destructive/50 bg-destructive/5",
        )}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {model.integrity.valid ? (
              <ShieldCheck className="size-5 text-chart-5" aria-hidden />
            ) : (
              <ShieldX className="size-5 text-destructive" aria-hidden />
            )}
            Evidence integrity:{" "}
            {model.integrity.valid ? "verified, chain intact" : "verification failed"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {model.integrity.valid ? (
            <>
              <p>
                All {model.integrity.length} events in this session form an unbroken SHA-256 hash
                chain. Each event&apos;s digest covers the previous event&apos;s digest, its own
                payload, its server-assigned timestamp and its type, so inserting, removing,
                reordering or editing any event would break the chain at that point. Timestamps come
                from the server; the browser cannot set them.
              </p>
              <p className="font-mono text-xs">
                chain head {shortHash(model.integrity.headHash)}
              </p>
            </>
          ) : (
            <>
              <p>{model.integrity.reason}</p>
              <p>
                The break is at event {(model.integrity.brokenAtIndex ?? 0) + 1}. Everything below
                is reconstructed from the same log and should be treated as unconfirmed until the
                cause is established.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* --------------------------------------------- executive summary */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Executive summary</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {model.executive_summary}
        </p>

        <h3 className="mt-5 text-sm font-semibold">Root cause</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{model.scenario.root_cause}</p>
      </section>

      <Separator />

      {/* -------------------------------------------------------- IOCs */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Indicators of compromise</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Indicator</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {model.iocs.map((ioc) => (
                <tr key={`${ioc.value}-${ioc.status}`} className="border-b border-border/60">
                  <td className="py-2 pr-4 font-mono text-xs break-all">{ioc.value}</td>
                  <td className="py-2 pr-4 text-xs capitalize text-muted-foreground">
                    {ioc.ioc_type}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge
                      variant={
                        ioc.status === "correct"
                          ? "success"
                          : ioc.status === "missed"
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {ioc.status === "correct"
                        ? "Identified"
                        : ioc.status === "missed"
                          ? "Missed"
                          : "False positive"}
                    </Badge>
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">{ioc.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------------- MITRE */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">MITRE ATT&amp;CK coverage</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {model.techniques.map((technique) => (
            <li
              key={technique.id}
              className={cn(
                "flex items-start gap-2 rounded-md border p-2.5",
                technique.matched ? "border-chart-5/40 bg-chart-5/5" : "border-border",
              )}
            >
              {technique.matched ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-chart-5" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="font-mono text-xs">{technique.id}</p>
                <p className="text-sm">{technique.name}</p>
                <p className="text-xs text-muted-foreground">{technique.tactic}</p>
              </div>
              <span className="sr-only">
                {technique.matched ? "identified" : "not identified"}
              </span>
            </li>
          ))}
        </ul>

        {model.technique_false_positives.length > 0 ? (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-muted-foreground">
            <span className="font-medium text-destructive">
              Claimed without supporting evidence:
            </span>{" "}
            {model.technique_false_positives.join(", ")}. Mapping an incident to techniques it does
            not show is how threat intelligence gets polluted.
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------------- OWASP */}
      {model.owasp.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">OWASP Top 10 (2021)</h2>
          <ul className="mt-3 space-y-2">
            {model.owasp.map((category) => (
              <li key={category.code} className="rounded-md border border-border p-3">
                <p className="text-sm font-medium">{category.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{category.plain_language}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Separator />

      {/* --------------------------------------------------- timeline */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Timeline of analyst actions</h2>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Reconstructed by replaying the session&apos;s event log in order.
        </p>
        <ol className="mt-3 space-y-1.5">
          {model.timeline.map((row, index) => (
            <li key={index} className="flex gap-3 rounded-md border border-border/60 p-2.5">
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {formatUtc(row.at).slice(11, 19)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{row.action}</span>
                  {row.phase ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {PHASE_LABELS[row.phase]}
                    </span>
                  ) : null}
                </p>
                {row.detail ? (
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">{row.detail}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* -------------------------------------------------- decisions */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Decisions recorded</h2>
        <div className="mt-3 space-y-3">
          {g.decisions.map((decision) => (
            <Card key={decision.decision_key}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-sm">{decision.prompt}</CardTitle>
                  <Badge
                    variant={
                      decision.correct === null
                        ? "secondary"
                        : decision.correct
                          ? "success"
                          : "destructive"
                    }
                    className="shrink-0"
                  >
                    {decision.correct === null
                      ? "Not graded"
                      : decision.correct
                        ? "Correct"
                        : "Incorrect"}
                  </Badge>
                </div>
                <CardDescription>
                  {PHASE_LABELS[decision.phase]} &middot; {decision.points_earned}/
                  {decision.points_possible} points
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                <p>
                  <span className="text-muted-foreground">Answered: </span>
                  {decision.given_labels.join("; ") || "Not answered"}
                </p>
                {decision.expected_labels.length > 0 && decision.correct === false ? (
                  <p>
                    <span className="text-muted-foreground">Expected: </span>
                    {decision.expected_labels.join("; ")}
                  </p>
                ) : null}
                {decision.student_rationale ? (
                  <p className="rounded-md border border-border bg-secondary/40 p-2.5 text-xs">
                    <span className="font-medium">Analyst&apos;s reasoning: </span>
                    {decision.student_rationale}
                  </p>
                ) : null}
                {showModelAnswers ? (
                  <details className="rounded-md border border-border p-2.5">
                    <summary className="cursor-pointer text-xs font-medium">
                      Why this is the answer
                    </summary>
                    <div className="mt-2">
                      <Markdown className="text-xs">{decision.rationale_md}</Markdown>
                    </div>
                  </details>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- reflection */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Lessons learned</h2>
        {model.reflection ? (
          <div className="mt-3 space-y-4">
            {(
              [
                ["What happened", model.reflection.what_happened],
                ["What worked", model.reflection.what_worked],
                ["What should change", model.reflection.what_to_change],
              ] as const
            ).map(([label, body]) => (
              <div key={label}>
                <h3 className="text-sm font-semibold">{label}</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {body || "Not completed."}
                </p>
              </div>
            ))}

            <div>
              <h3 className="text-sm font-semibold">Recommended controls</h3>
              <ul className="mt-1 space-y-1">
                {model.reflection.recommended_controls
                  .filter((c) => c.trim())
                  .map((control) => (
                    <li key={control} className="flex gap-2 text-sm text-muted-foreground">
                      <span aria-hidden>&middot;</span>
                      {control}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            The post-incident review was not completed.
          </p>
        )}

        {showModelAnswers ? (
          <details className="mt-4 rounded-md border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Model recommendations for comparison
            </summary>
            <ul className="mt-2 space-y-1.5">
              {model.scenario.model_recommendations.map((recommendation) => (
                <li key={recommendation} className="flex gap-2 text-xs text-muted-foreground">
                  <span aria-hidden>&middot;</span>
                  {recommendation}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {/* ------------------------------------------------------ badges */}
      {g.badges.length > 0 ? (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Award className="size-5 text-primary" aria-hidden />
            Badges earned
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {g.badges.map((key) => (
              <li key={key}>
                <Badge variant="default" className="px-3 py-1">
                  {badgeByKey.get(key)?.name ?? key}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ------------------------------------------------- instructor */}
      <section>
        <h2 className="text-lg font-semibold tracking-tight">Instructor comments</h2>
        {model.instructor_comments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No comments recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {model.instructor_comments.map((comment, index) => (
              <li key={index} className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  {comment.instructor_handle} &middot; {formatUtc(comment.created_at)}
                </p>
                <p className="mt-1 text-sm">{comment.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SyntheticDataNotice variant="card" />

      <p className="text-center text-xs text-muted-foreground">
        Generated from {model.event_count} recorded events.{" "}
        <Link href="/mitre" className="text-primary underline underline-offset-2">
          ATT&amp;CK reference
        </Link>
      </p>
    </article>
  );
}
