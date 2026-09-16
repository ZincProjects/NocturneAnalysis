/**
 * The closed set of things a session can record.
 *
 * Every meaningful interaction in the console maps to exactly one of these.
 * The list is mirrored by the `event_type` enum in the database and by the
 * `append-event` Edge Function, so adding a member means touching all three.
 */
export const EVENT_TYPES = [
  "SESSION_START",
  "SESSION_PAUSE",
  "SESSION_RESUME",
  "SESSION_COMPLETE",
  "VIEW_ALERT",
  "RUN_QUERY",
  "VIEW_LOG_ENTRY",
  "TAG_IOC",
  "UNTAG_IOC",
  "ADD_NOTE",
  "SUBMIT_DECISION",
  "REQUEST_HINT",
  "PHASE_TRANSITION",
  "CONTAIN_HOST",
  "ISOLATE_ACCOUNT",
  "BLOCK_INDICATOR",
  "ESCALATE",
  "DOWNLOAD_ARTIFACT",
  "SUBMIT_REPORT",
  "INSTRUCTOR_COMMENT",
  "GRADE_ASSIGNED",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const PHASE_KEYS = [
  "triage",
  "investigation",
  "containment",
  "eradication",
  "recovery",
  "lessons_learned",
] as const;

export type PhaseKey = (typeof PHASE_KEYS)[number];

export const PHASE_LABELS: Record<PhaseKey, string> = {
  triage: "Triage",
  investigation: "Investigation",
  containment: "Containment",
  eradication: "Eradication",
  recovery: "Recovery",
  lessons_learned: "Lessons Learned",
};

/** NIST SP 800-61 stage each app phase corresponds to, shown in SOC 101. */
export const PHASE_NIST_MAPPING: Record<PhaseKey, string> = {
  triage: "Detection & Analysis",
  investigation: "Detection & Analysis",
  containment: "Containment",
  eradication: "Eradication",
  recovery: "Recovery",
  lessons_learned: "Post-Incident Activity",
};

export interface SessionEvent {
  id: string;
  session_id: string;
  user_id: string | null;
  event_type: EventType;
  phase: PhaseKey | null;
  payload: Record<string, unknown>;
  created_at: string;
  prev_hash: string | null;
  hash: string;
  client_meta: Record<string, unknown> | null;
}

/** The subset of an event that participates in the hash. */
export interface HashableEvent {
  event_type: EventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (EVENT_TYPES as readonly string[]).includes(value);
}

export function isPhaseKey(value: unknown): value is PhaseKey {
  return typeof value === "string" && (PHASE_KEYS as readonly string[]).includes(value);
}

export function phaseIndex(phase: PhaseKey): number {
  return PHASE_KEYS.indexOf(phase);
}

export function nextPhase(phase: PhaseKey): PhaseKey | null {
  const i = phaseIndex(phase);
  return i >= 0 && i < PHASE_KEYS.length - 1 ? PHASE_KEYS[i + 1] : null;
}
