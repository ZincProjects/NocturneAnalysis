import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { buildReport, reportSummary, type ReportModel } from "./build";
import { renderReportMarkdown } from "./markdown";
import { IncidentReportDocument } from "./pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScenarioBundleOrThrow, listMitreTechniques, listOwaspCategories } from "@/lib/content/loader";
import type { SessionEvent } from "@/lib/events/types";

/**
 * Finalises a submitted session: grades it, renders both report formats,
 * stores them, and records the badges earned.
 *
 * Runs in the Next.js Node runtime rather than as a Deno Edge Function, which
 * is a deliberate departure from the original architecture sketch. The reason
 * is @react-pdf/renderer: it is a Node library and does not run on the Edge
 * Function runtime, and it was chosen precisely to avoid needing a headless
 * browser in a serverless environment. Splitting grading into Deno and PDF
 * rendering into Node would mean maintaining the grading rules twice, which is
 * a worse trade than keeping both here where the content library and the
 * grading engine already live.
 *
 * What has not changed is where trust sits: nothing in the request body
 * influences the outcome. The score is recomputed by replaying the event log,
 * which the student cannot write to directly.
 */

const REPORT_BUCKET = "reports";

export interface GeneratedReport {
  model: ReportModel;
  markdown: string;
  pdfPath: string | null;
  score: number;
  maxScore: number;
}

export async function generateReportForSession(sessionId: string): Promise<GeneratedReport> {
  const admin = createAdminClient();

  const { data: session, error: sessionError } = await admin
    .from("sessions")
    .select("id, scenario_id, user_id, org_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(`Could not read the session: ${sessionError.message}`);
  if (!session) throw new Error("Session not found");

  const [{ data: scenarioRow }, { data: profile }, { data: org }, { data: eventRows }] =
    await Promise.all([
      admin.from("scenarios").select("slug").eq("id", session.scenario_id).maybeSingle(),
      admin.from("profiles").select("handle").eq("id", session.user_id).maybeSingle(),
      admin.from("organizations").select("name").eq("id", session.org_id).maybeSingle(),
      admin
        .from("session_events")
        .select("*")
        .eq("session_id", sessionId)
        .order("seq", { ascending: true }),
    ]);

  if (!scenarioRow) throw new Error("The scenario for this session no longer exists");

  const bundle = getScenarioBundleOrThrow(scenarioRow.slug);

  const events: SessionEvent[] = (eventRows ?? []).map((row) => ({
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    event_type: row.event_type,
    phase: row.phase,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    created_at: row.created_at,
    prev_hash: row.prev_hash,
    hash: row.hash,
    client_meta: (row.client_meta ?? null) as Record<string, unknown> | null,
  }));

  if (!events.some((e) => e.event_type === "SUBMIT_REPORT")) {
    throw new Error("This session has not been submitted yet");
  }

  const model = await buildReport({
    sessionId,
    bundle,
    events,
    analystHandle: profile?.handle ?? "anonymous-analyst",
    organizationName: org?.name ?? "Unknown organisation",
    techniques: listMitreTechniques(),
    owasp: listOwaspCategories().filter((c) => bundle.scenario.owasp_categories.includes(c.code)),
  });

  const markdown = renderReportMarkdown(model);
  const summary = reportSummary(model);

  // ------------------------------------------------------------ the PDF --
  let pdfPath: string | null = null;
  try {
    const pdf = await renderToBuffer(IncidentReportDocument({ model }));
    const path = `${session.org_id}/${sessionId}.pdf`;

    const { error: uploadError } = await admin.storage
      .from(REPORT_BUCKET)
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });

    if (uploadError) throw uploadError;
    pdfPath = path;
  } catch (err) {
    // A failed upload must not cost the student their submission. The report
    // is still readable on the web and downloadable as Markdown, and the PDF
    // can be re-rendered on demand from the same model.
    console.error(`[report] PDF storage failed for session ${sessionId}:`, err);
  }

  // ------------------------------------------------------- persist rows --
  const { error: mdError } = await admin.from("reports").upsert(
    {
      session_id: sessionId,
      format: "markdown",
      body_md: markdown,
      summary: summary as never,
      chain_head_hash: model.integrity.headHash,
    },
    { onConflict: "session_id,format" },
  );
  if (mdError) throw new Error(`Could not store the report: ${mdError.message}`);

  if (pdfPath) {
    await admin.from("reports").upsert(
      {
        session_id: sessionId,
        format: "pdf",
        storage_path: pdfPath,
        summary: summary as never,
        chain_head_hash: model.integrity.headHash,
      },
      { onConflict: "session_id,format" },
    );
  }

  await admin
    .from("sessions")
    .update({
      status: "submitted",
      score: model.grade.score,
      max_score: model.grade.max_score,
      completed_at: model.completed_at ?? new Date().toISOString(),
      current_phase: "lessons_learned",
    })
    .eq("id", sessionId);

  // ---------------------------------------------------------- badges ----
  if (model.grade.badges.length > 0) {
    const { data: badgeRows } = await admin
      .from("badges")
      .select("id, key")
      .in("key", model.grade.badges);

    if (badgeRows && badgeRows.length > 0) {
      await admin.from("session_badges").upsert(
        badgeRows.map((badge) => ({ session_id: sessionId, badge_id: badge.id })),
        { onConflict: "session_id,badge_id" },
      );
    }
  }

  return {
    model,
    markdown,
    pdfPath,
    score: model.grade.score,
    maxScore: model.grade.max_score,
  };
}

/** Rebuilds the report model without writing anything - used by report pages. */
export async function readReportModel(sessionId: string): Promise<ReportModel | null> {
  const admin = createAdminClient();

  const { data: session } = await admin
    .from("sessions")
    .select("id, scenario_id, user_id, org_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return null;

  const [{ data: scenarioRow }, { data: profile }, { data: org }, { data: eventRows }] =
    await Promise.all([
      admin.from("scenarios").select("slug").eq("id", session.scenario_id).maybeSingle(),
      admin.from("profiles").select("handle").eq("id", session.user_id).maybeSingle(),
      admin.from("organizations").select("name").eq("id", session.org_id).maybeSingle(),
      admin
        .from("session_events")
        .select("*")
        .eq("session_id", sessionId)
        .order("seq", { ascending: true }),
    ]);

  if (!scenarioRow) return null;
  const bundle = getScenarioBundleOrThrow(scenarioRow.slug);

  return buildReport({
    sessionId,
    bundle,
    events: (eventRows ?? []).map((row) => ({
      id: row.id,
      session_id: row.session_id,
      user_id: row.user_id,
      event_type: row.event_type,
      phase: row.phase,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      created_at: row.created_at,
      prev_hash: row.prev_hash,
      hash: row.hash,
      client_meta: (row.client_meta ?? null) as Record<string, unknown> | null,
    })),
    analystHandle: profile?.handle ?? "anonymous-analyst",
    organizationName: org?.name ?? "Unknown organisation",
    techniques: listMitreTechniques(),
    owasp: listOwaspCategories().filter((c) => bundle.scenario.owasp_categories.includes(c.code)),
  });
}
