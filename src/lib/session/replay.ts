import { PHASE_KEYS, type PhaseKey, type SessionEvent } from "@/lib/events/types";
import { isActionEvent, type EventPayloadMap, type SessionReflection } from "@/lib/events/payloads";

/**
 * Reconstructs everything about a session by replaying its event log in order.
 *
 * There is intentionally no other store of "what the student did". The console
 * reads this, the instructor's grading view reads this, and the generated PDF
 * reads this - so the report can never disagree with the audit trail, which is
 * the whole point of the tamper-evident log.
 */

export interface TaggedIoc {
  value: string;
  ioc_type: string;
  phase: PhaseKey;
  tagged_at: string;
  source_log_id?: string;
  note?: string;
}

export interface RecordedDecision {
  decision_key: string;
  decision_value: string | string[];
  rationale?: string;
  phase: PhaseKey;
  submitted_at: string;
}

export interface RecordedAction {
  action_key: string;
  event_type: string;
  target: string;
  phase: PhaseKey;
  performed_at: string;
}

export interface RecordedNote {
  text: string;
  phase: PhaseKey;
  created_at: string;
}

export interface RecordedQuery {
  query: string;
  result_count: number;
  phase: PhaseKey;
  run_at: string;
}

export interface RecordedHint {
  hint_key: string;
  cost: number;
  phase: PhaseKey;
  requested_at: string;
}

export interface InstructorComment {
  comment: string;
  instructor_handle: string;
  created_at: string;
}

export interface PhaseTiming {
  phase: PhaseKey;
  entered_at: string;
  exited_at: string | null;
  duration_ms: number | null;
}

export interface ReplayedSession {
  startedAt: string | null;
  completedAt: string | null;
  reportSubmittedAt: string | null;
  scenarioSlug: string | null;
  currentPhase: PhaseKey;
  /** Phases the student has transitioned out of, i.e. completed. */
  completedPhases: PhaseKey[];
  phaseTimings: PhaseTiming[];

  viewedAlertIds: string[];
  viewedLogIds: string[];
  queries: RecordedQuery[];
  notes: RecordedNote[];
  /** Latest tag wins; untagging removes the entry entirely. */
  taggedIocs: TaggedIoc[];
  /** Latest submission per decision key. */
  decisions: RecordedDecision[];
  actions: RecordedAction[];
  hints: RecordedHint[];

  reflection: SessionReflection | null;
  executiveSummary: string | null;
  instructorComments: InstructorComment[];
  assignedGrade: { score: number; max_score: number; note?: string } | null;

  /** Wall-clock time from SESSION_START to completion, excluding pauses. */
  activeDurationMs: number;
  eventCount: number;
}

type Payload<K extends keyof EventPayloadMap> = EventPayloadMap[K];

function phaseOf(event: SessionEvent, fallback: PhaseKey): PhaseKey {
  return event.phase ?? fallback;
}

export function replaySession(events: SessionEvent[]): ReplayedSession {
  const ordered = [...events].sort((a, b) => {
    const t = a.created_at.localeCompare(b.created_at);
    return t !== 0 ? t : a.id.localeCompare(b.id);
  });

  const state: ReplayedSession = {
    startedAt: null,
    completedAt: null,
    reportSubmittedAt: null,
    scenarioSlug: null,
    currentPhase: "triage",
    completedPhases: [],
    phaseTimings: [],
    viewedAlertIds: [],
    viewedLogIds: [],
    queries: [],
    notes: [],
    taggedIocs: [],
    decisions: [],
    actions: [],
    hints: [],
    reflection: null,
    executiveSummary: null,
    instructorComments: [],
    assignedGrade: null,
    activeDurationMs: 0,
    eventCount: ordered.length,
  };

  const iocsByValue = new Map<string, TaggedIoc>();
  const decisionsByKey = new Map<string, RecordedDecision>();
  const viewedAlerts = new Set<string>();
  const viewedLogs = new Set<string>();

  let pausedAt: string | null = null;
  let pausedMs = 0;
  let currentTiming: PhaseTiming | null = null;

  const openTiming = (phase: PhaseKey, at: string) => {
    if (currentTiming) {
      currentTiming.exited_at = at;
      currentTiming.duration_ms = Date.parse(at) - Date.parse(currentTiming.entered_at);
    }
    currentTiming = { phase, entered_at: at, exited_at: null, duration_ms: null };
    state.phaseTimings.push(currentTiming);
  };

  for (const event of ordered) {
    const phase = phaseOf(event, state.currentPhase);

    switch (event.event_type) {
      case "SESSION_START": {
        const p = event.payload as Payload<"SESSION_START">;
        state.startedAt ??= event.created_at;
        state.scenarioSlug = p.scenario_slug ?? state.scenarioSlug;
        if (!currentTiming) openTiming(state.currentPhase, event.created_at);
        break;
      }

      case "SESSION_PAUSE":
        pausedAt = event.created_at;
        break;

      case "SESSION_RESUME":
        if (pausedAt) {
          pausedMs += Date.parse(event.created_at) - Date.parse(pausedAt);
          pausedAt = null;
        }
        break;

      case "SESSION_COMPLETE":
        state.completedAt = event.created_at;
        if (currentTiming) {
          currentTiming.exited_at = event.created_at;
          currentTiming.duration_ms =
            Date.parse(event.created_at) - Date.parse(currentTiming.entered_at);
        }
        break;

      case "PHASE_TRANSITION": {
        const p = event.payload as Payload<"PHASE_TRANSITION">;
        if (p.from && !state.completedPhases.includes(p.from)) {
          state.completedPhases.push(p.from);
        }
        state.currentPhase = p.to;
        openTiming(p.to, event.created_at);
        break;
      }

      case "VIEW_ALERT": {
        const p = event.payload as Payload<"VIEW_ALERT">;
        if (p.alert_id) viewedAlerts.add(p.alert_id);
        break;
      }

      case "VIEW_LOG_ENTRY": {
        const p = event.payload as Payload<"VIEW_LOG_ENTRY">;
        if (p.log_id) viewedLogs.add(p.log_id);
        break;
      }

      case "RUN_QUERY": {
        const p = event.payload as Payload<"RUN_QUERY">;
        state.queries.push({
          query: p.query ?? "",
          result_count: p.result_count ?? 0,
          phase,
          run_at: event.created_at,
        });
        break;
      }

      case "TAG_IOC": {
        const p = event.payload as Payload<"TAG_IOC">;
        iocsByValue.set(p.value, {
          value: p.value,
          ioc_type: p.ioc_type,
          phase,
          tagged_at: event.created_at,
          source_log_id: p.source_log_id,
          note: p.note,
        });
        break;
      }

      case "UNTAG_IOC": {
        const p = event.payload as Payload<"UNTAG_IOC">;
        iocsByValue.delete(p.value);
        break;
      }

      case "ADD_NOTE": {
        const p = event.payload as Payload<"ADD_NOTE">;
        state.notes.push({ text: p.text ?? "", phase, created_at: event.created_at });
        break;
      }

      case "SUBMIT_DECISION": {
        const p = event.payload as Payload<"SUBMIT_DECISION">;
        decisionsByKey.set(p.decision_key, {
          decision_key: p.decision_key,
          decision_value: p.decision_value,
          rationale: p.rationale,
          phase,
          submitted_at: event.created_at,
        });
        break;
      }

      case "REQUEST_HINT": {
        const p = event.payload as Payload<"REQUEST_HINT">;
        state.hints.push({
          hint_key: p.hint_key,
          cost: p.cost ?? 0,
          phase,
          requested_at: event.created_at,
        });
        break;
      }

      case "SUBMIT_REPORT": {
        const p = event.payload as Payload<"SUBMIT_REPORT">;
        state.reportSubmittedAt = event.created_at;
        state.reflection = p.reflection ?? null;
        state.executiveSummary = p.executive_summary ?? null;
        break;
      }

      case "INSTRUCTOR_COMMENT": {
        const p = event.payload as Payload<"INSTRUCTOR_COMMENT">;
        state.instructorComments.push({
          comment: p.comment,
          instructor_handle: p.instructor_handle,
          created_at: event.created_at,
        });
        break;
      }

      case "GRADE_ASSIGNED": {
        const p = event.payload as Payload<"GRADE_ASSIGNED">;
        state.assignedGrade = { score: p.score, max_score: p.max_score, note: p.note };
        break;
      }

      default: {
        if (isActionEvent(event.event_type)) {
          const p = event.payload as Payload<"CONTAIN_HOST">;
          state.actions.push({
            action_key: p.action_key,
            event_type: event.event_type,
            target: p.target,
            phase,
            performed_at: event.created_at,
          });
        }
        break;
      }
    }
  }

  // A session left paused when the log ends is still paused now.
  if (pausedAt) {
    pausedMs += Date.now() - Date.parse(pausedAt);
  }

  state.viewedAlertIds = [...viewedAlerts];
  state.viewedLogIds = [...viewedLogs];
  state.taggedIocs = [...iocsByValue.values()];
  state.decisions = [...decisionsByKey.values()];

  const end = state.completedAt ?? ordered.at(-1)?.created_at ?? state.startedAt;
  if (state.startedAt && end) {
    state.activeDurationMs = Math.max(0, Date.parse(end) - Date.parse(state.startedAt) - pausedMs);
  }

  // Keep completedPhases in lifecycle order regardless of transition order.
  state.completedPhases.sort((a, b) => PHASE_KEYS.indexOf(a) - PHASE_KEYS.indexOf(b));

  return state;
}

/** Time from the first alert view to the first correct containment action. */
export function timeToContainMs(state: ReplayedSession): number | null {
  const firstContainment = state.actions.find((a) => a.phase === "containment");
  if (!state.startedAt || !firstContainment) return null;
  return Date.parse(firstContainment.performed_at) - Date.parse(state.startedAt);
}
