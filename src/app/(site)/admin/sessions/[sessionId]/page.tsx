import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, ShieldX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportView } from "@/components/report/report-view";
import { InstructorTools } from "@/components/admin/instructor-tools";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { readReportModel } from "@/lib/report/generate";
import { hasServiceRoleKey } from "@/lib/supabase/admin";
import { PHASE_LABELS } from "@/lib/events/types";
import { shortHash } from "@/lib/events/hash";
import { formatUtc } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Review session",
  robots: { index: false, follow: false },
};

export default async function AdminSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const viewer = await requireStaff();
  const supabase = await createClient();

  // RLS restricts this to the instructor's own organisation.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id, scenario_id, status, current_phase, score, max_score, adjusted_score, started_at, completed_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) notFound();

  const [{ data: student }, { data: scenario }, { data: comments }] = await Promise.all([
    supabase.from("profiles").select("handle, display_name, cohort").eq("id", session.user_id).maybeSingle(),
    supabase.from("scenarios").select("slug, title").eq("id", session.scenario_id).maybeSingle(),
    supabase
      .from("instructor_comments")
      .select("id, comment, phase, created_at, instructor_id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
  ]);

  // The SQL-side linkage check, run independently of the application's own
  // recomputation. If the two ever disagreed, that would itself be a finding.
  const { data: chain } = await supabase.rpc("verify_session_chain", { p_session_id: sessionId });
  const chainRow = Array.isArray(chain) ? chain[0] : null;

  const model = hasServiceRoleKey() ? await readReportModel(sessionId) : null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/admin">
          <ArrowLeft className="size-4" />
          Back to the class dashboard
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{scenario?.title ?? "Unknown scenario"}</CardTitle>
            <Badge variant="secondary">{student?.handle ?? "unknown"}</Badge>
            <Badge variant="outline" className="capitalize">
              {session.status}
            </Badge>
          </div>
          <CardDescription>
            {/* Staff can see the real name; it never appears on a shared or
                public view, and never in the generated report. */}
            {student?.display_name}
            {student?.cohort ? ` · ${student.cohort}` : ""} · started{" "}
            {formatUtc(session.started_at)}
            {session.completed_at ? ` · submitted ${formatUtc(session.completed_at)}` : ""}
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Machine score</p>
            <p className="text-xl font-semibold tabular-nums">
              {session.score !== null ? `${session.score} / ${session.max_score}` : "Not graded"}
            </p>
            {session.adjusted_score !== null ? (
              <p className="text-xs text-muted-foreground">
                Adjusted to {session.adjusted_score}
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Current phase</p>
            <p className="text-xl font-semibold">{PHASE_LABELS[session.current_phase]}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Audit log integrity</p>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              {chainRow?.linkage_valid ? (
                <>
                  <ShieldCheck className="size-4 text-chart-5" aria-hidden />
                  {chainRow.event_count} events, links intact
                </>
              ) : (
                <>
                  <ShieldX className="size-4 text-destructive" aria-hidden />
                  Broken at sequence {chainRow?.broken_at_seq ?? "unknown"}
                </>
              )}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              head {shortHash(chainRow?.head_hash ?? null)}
            </p>
          </div>
        </CardContent>
      </Card>

      <InstructorTools
        sessionId={sessionId}
        instructorHandle={viewer.profile.handle}
        currentScore={session.score}
        maxScore={session.max_score}
        adjustedScore={session.adjusted_score}
        comments={(comments ?? []).map((c) => ({
          id: c.id,
          comment: c.comment,
          phase: c.phase,
          created_at: c.created_at,
          mine: c.instructor_id === viewer.userId,
        }))}
      />

      {model ? (
        <ReportView model={model} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report unavailable</CardTitle>
            <CardDescription>
              {hasServiceRoleKey()
                ? "This session has not been submitted yet, so there is no report to grade. The live class view shows where the student has got to."
                : "SUPABASE_SERVICE_ROLE_KEY is not configured on the server, so reports cannot be rendered. See .env.example."}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
