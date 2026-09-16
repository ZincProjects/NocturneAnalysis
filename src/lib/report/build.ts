import { verifyChain, type ChainVerification } from "@/lib/events/hash";
import { PHASE_KEYS, PHASE_LABELS, type PhaseKey, type SessionEvent } from "@/lib/events/types";
import { replaySession, timeToContainMs, type ReplayedSession } from "@/lib/session/replay";
import { gradeSession, type GradeResult } from "@/lib/grading/engine";
import type { MitreTechnique, OwaspCategory, ScenarioBundle } from "@/lib/content/schema";
import { formatDuration, formatUtc } from "@/lib/utils";

/**
 * Assembles the incident report.
 *
 * Every figure in here is derived from the event log, not from a parallel
 * record kept while the student worked. That is what makes the report
 * defensible: an instructor who doubts a number can replay the same events and
 * get the same answer, and the integrity section tells them whether those
 * events have been touched since they were written.
 */

export interface TimelineRow {
  at: string;
  phase: PhaseKey | null;
  actor: "analyst" | "instructor" | "system";
  action: string;
  detail: string;
}

export interface ReportModel {
  scenario: {
    slug: string;
    title: string;
    category: string;
    difficulty: string;
    organization: string;
    root_cause: string;
    model_recommendations: string[];
  };
  analyst_handle: string;
  organization_name: string;
  session_id: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number;
  time_to_contain_ms: number | null;
  executive_summary: string;
  timeline: TimelineRow[];
  phase_durations: { phase: PhaseKey; label: string; duration_ms: number | null }[];
  grade: GradeResult;
  techniques: {
    id: string;
    name: string;
    tactic: string;
    matched: boolean;
  }[];
  technique_false_positives: string[];
  owasp: { code: string; name: string; plain_language: string }[];
  iocs: GradeResult["iocs"];
  notes: { phase: PhaseKey; text: string; at: string }[];
  reflection: ReplayedSession["reflection"];
  queries: { query: string; results: number; at: string }[];
  hints_used: { key: string; cost: number; phase: PhaseKey }[];
  integrity: ChainVerification;
  instructor_comments: ReplayedSession["instructorComments"];
  generated_at: string;
  event_count: number;
}

const ACTION_LABELS: Record<string, string> = {
  SESSION_START: "Session started",
  SESSION_PAUSE: "Session paused",
  SESSION_RESUME: "Session resumed",
  SESSION_COMPLETE: "Session completed",
  VIEW_ALERT: "Opened alert",
  RUN_QUERY: "Searched logs",
  VIEW_LOG_ENTRY: "Examined log entry",
  TAG_IOC: "Tagged indicator",
  UNTAG_IOC: "Withdrew indicator",
  ADD_NOTE: "Recorded note",
  SUBMIT_DECISION: "Recorded decision",
  REQUEST_HINT: "Requested hint",
  PHASE_TRANSITION: "Advanced phase",
  CONTAIN_HOST: "Isolated host",
  ISOLATE_ACCOUNT: "Disabled account",
  BLOCK_INDICATOR: "Blocked indicator",
  ESCALATE: "Escalated",
  DOWNLOAD_ARTIFACT: "Requested forensic artefact",
  SUBMIT_REPORT: "Submitted report",
  INSTRUCTOR_COMMENT: "Instructor comment",
  GRADE_ASSIGNED: "Grade assigned",
};

/**
 * The timeline keeps the analyst's decisions and actions and drops the
 * navigation noise. Every event is still in the exported log; a report that
 * listed four hundred "read log entry" rows would bury the narrative it exists
 * to tell.
 */
const TIMELINE_EVENTS = new Set([
  "SESSION_START",
  "SESSION_COMPLETE",
  "PHASE_TRANSITION",
  "SUBMIT_DECISION",
  "TAG_IOC",
  "UNTAG_IOC",
  "CONTAIN_HOST",
  "ISOLATE_ACCOUNT",
  "BLOCK_INDICATOR",
  "ESCALATE",
  "DOWNLOAD_ARTIFACT",
  "REQUEST_HINT",
  "ADD_NOTE",
  "SUBMIT_REPORT",
  "INSTRUCTOR_COMMENT",
  "GRADE_ASSIGNED",
]);

function detailFor(event: SessionEvent, bundle: ScenarioBundle): string {
  const p = event.payload as Record<string, unknown>;

  switch (event.event_type) {
    case "SUBMIT_DECISION": {
      const key = String(p.decision_key ?? "");
      const spec = bundle.scenario.phases.flatMap((ph) => ph.decisions).find((d) => d.key === key);
      const raw = Array.isArray(p.decision_value) ? p.decision_value : [p.decision_value];
      const labels = raw.map((v) => spec?.options.find((o) => o.value === v)?.label ?? String(v));
      return `${spec?.prompt ?? key} — ${labels.join("; ")}`;
    }
    case "TAG_IOC":
    case "UNTAG_IOC":
      return String(p.value ?? "");
    case "PHASE_TRANSITION":
      return `${p.from ? PHASE_LABELS[p.from as PhaseKey] : "Start"} to ${PHASE_LABELS[p.to as PhaseKey]}`;
    case "ADD_NOTE":
      return String(p.text ?? "");
    case "REQUEST_HINT":
      return `${String(p.hint_key ?? "")} (cost ${String(p.cost ?? 0)})`;
    case "CONTAIN_HOST":
    case "ISOLATE_ACCOUNT":
    case "BLOCK_INDICATOR":
    case "ESCALATE":
    case "DOWNLOAD_ARTIFACT": {
      const key = String(p.action_key ?? "");
      const spec = bundle.scenario.phases.flatMap((ph) => ph.actions).find((a) => a.key === key);
      return spec ? `${spec.label} (${spec.target})` : String(p.target ?? "");
    }
    case "GRADE_ASSIGNED":
      return `${String(p.score ?? "")} / ${String(p.max_score ?? "")}`;
    case "INSTRUCTOR_COMMENT":
      return String(p.comment ?? "");
    default:
      return "";
  }
}

export interface BuildReportInput {
  sessionId: string;
  bundle: ScenarioBundle;
  events: SessionEvent[];
  analystHandle: string;
  organizationName: string;
  techniques: MitreTechnique[];
  owasp: OwaspCategory[];
}

export async function buildReport(input: BuildReportInput): Promise<ReportModel> {
  const { bundle, events, sessionId } = input;
  const state = replaySession(events);
  const grade = gradeSession(bundle, state);
  const integrity = await verifyChain(
    events.map((e) => ({
      event_type: e.event_type,
      payload: e.payload,
      created_at: e.created_at,
      prev_hash: e.prev_hash,
      hash: e.hash,
    })),
  );

  const techniqueById = new Map(input.techniques.map((t) => [t.technique_id, t]));
  const matched = new Set(grade.mitre.matched);

  const timeline: TimelineRow[] = events
    .filter((e) => TIMELINE_EVENTS.has(e.event_type))
    .map((e) => ({
      at: e.created_at,
      phase: e.phase,
      actor:
        e.event_type === "INSTRUCTOR_COMMENT" || e.event_type === "GRADE_ASSIGNED"
          ? "instructor"
          : e.event_type === "SESSION_START" || e.event_type === "SESSION_COMPLETE"
            ? "system"
            : "analyst",
      action: ACTION_LABELS[e.event_type] ?? e.event_type,
      detail: detailFor(e, bundle),
    }));

  const executiveSummary =
    state.executiveSummary?.trim() ||
    state.reflection?.what_happened?.trim() ||
    "No executive summary was recorded for this session.";

  return {
    scenario: {
      slug: bundle.scenario.slug,
      title: bundle.scenario.title,
      category: bundle.scenario.category,
      difficulty: bundle.scenario.difficulty,
      organization: bundle.scenario.organization,
      root_cause: bundle.scenario.root_cause,
      model_recommendations: bundle.scenario.model_recommendations,
    },
    analyst_handle: input.analystHandle,
    organization_name: input.organizationName,
    session_id: sessionId,
    started_at: state.startedAt,
    completed_at: state.completedAt ?? state.reportSubmittedAt,
    duration_ms: state.activeDurationMs,
    time_to_contain_ms: timeToContainMs(state),
    executive_summary: executiveSummary,
    timeline,
    phase_durations: PHASE_KEYS.map((phase) => ({
      phase,
      label: PHASE_LABELS[phase],
      duration_ms:
        state.phaseTimings
          .filter((t) => t.phase === phase)
          .reduce<number | null>(
            (sum, t) => (t.duration_ms === null ? sum : (sum ?? 0) + t.duration_ms),
            null,
          ) ?? null,
    })),
    grade,
    techniques: bundle.scenario.mitre_techniques.map((id) => ({
      id,
      name: techniqueById.get(id)?.name ?? id,
      tactic: techniqueById.get(id)?.tactic ?? "Unknown",
      matched: matched.has(id),
    })),
    technique_false_positives: grade.mitre.false_positives,
    owasp: input.owasp.map((c) => ({
      code: c.code,
      name: c.name,
      plain_language: c.plain_language,
    })),
    iocs: grade.iocs,
    notes: state.notes.map((n) => ({ phase: n.phase, text: n.text, at: n.created_at })),
    reflection: state.reflection,
    queries: state.queries.map((q) => ({
      query: q.query,
      results: q.result_count,
      at: q.run_at,
    })),
    hints_used: state.hints.map((h) => ({ key: h.hint_key, cost: h.cost, phase: h.phase })),
    integrity,
    instructor_comments: state.instructorComments,
    generated_at: new Date().toISOString(),
    event_count: events.length,
  };
}

/** Compact object stored on the `reports` row for list views and dashboards. */
export function reportSummary(model: ReportModel) {
  return {
    scenario_slug: model.scenario.slug,
    scenario_title: model.scenario.title,
    analyst_handle: model.analyst_handle,
    score: model.grade.score,
    max_score: model.grade.max_score,
    percentage: model.grade.percentage,
    duration: formatDuration(model.duration_ms),
    duration_ms: model.duration_ms,
    time_to_contain_ms: model.time_to_contain_ms,
    techniques_matched: model.grade.mitre.matched.length,
    techniques_total: model.techniques.length,
    iocs_found: model.iocs.filter((i) => i.status === "correct").length,
    iocs_missed: model.iocs.filter((i) => i.status === "missed").length,
    false_positives: model.iocs.filter((i) => i.status === "false_positive").length,
    badges: model.grade.badges,
    chain_valid: model.integrity.valid,
    chain_head: model.integrity.headHash,
    event_count: model.event_count,
    completed_at: model.completed_at,
    generated_at: model.generated_at,
  };
}

export function formatReportTimestamp(iso: string | null): string {
  return iso ? formatUtc(iso) : "—";
}
