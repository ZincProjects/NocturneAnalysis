import type { EventType, PhaseKey } from "./types";
import type { iocTypeSchema } from "@/lib/content/schema";
import type { z } from "zod";

type IocType = z.infer<typeof iocTypeSchema>;

/**
 * Payload shapes, one per event type.
 *
 * The event log is the single source of truth for a session: the student's
 * review screen, the instructor's grading view and the generated PDF are all
 * projections of these rows. That only works if payloads are typed and stable,
 * so this map is the contract. Anything the replay in
 * `src/lib/session/replay.ts` needs must be in the payload - it cannot go
 * looking elsewhere.
 */
export interface EventPayloadMap {
  SESSION_START: { scenario_slug: string; resumed: boolean };
  SESSION_PAUSE: { reason?: string };
  SESSION_RESUME: Record<string, never>;
  SESSION_COMPLETE: { total_phases: number };

  VIEW_ALERT: { alert_id: string; severity: string };
  RUN_QUERY: { query: string; result_count: number; filters: Record<string, string> };
  VIEW_LOG_ENTRY: { log_id: string; source: string };

  TAG_IOC: { value: string; ioc_type: IocType; source_log_id?: string; note?: string };
  UNTAG_IOC: { value: string };
  ADD_NOTE: { text: string };

  SUBMIT_DECISION: {
    decision_key: string;
    decision_value: string | string[];
    rationale?: string;
  };
  REQUEST_HINT: { hint_key: string; cost: number };
  PHASE_TRANSITION: { from: PhaseKey | null; to: PhaseKey };

  CONTAIN_HOST: { action_key: string; target: string };
  ISOLATE_ACCOUNT: { action_key: string; target: string };
  BLOCK_INDICATOR: { action_key: string; target: string };
  ESCALATE: { action_key: string; target: string; note?: string };
  DOWNLOAD_ARTIFACT: { action_key: string; target: string };

  SUBMIT_REPORT: {
    reflection: SessionReflection;
    executive_summary: string;
  };
  INSTRUCTOR_COMMENT: { comment: string; instructor_handle: string };
  GRADE_ASSIGNED: { score: number; max_score: number; adjusted_by?: string; note?: string };
}

/** The mandatory lessons-learned write-up. */
export interface SessionReflection {
  what_happened: string;
  what_worked: string;
  what_to_change: string;
  recommended_controls: string[];
}

export type PayloadFor<T extends EventType> = T extends keyof EventPayloadMap
  ? EventPayloadMap[T]
  : Record<string, unknown>;

/** Event types produced by the action panel, mapped to their action spec. */
export const ACTION_EVENT_TYPES = [
  "CONTAIN_HOST",
  "ISOLATE_ACCOUNT",
  "BLOCK_INDICATOR",
  "ESCALATE",
  "DOWNLOAD_ARTIFACT",
] as const satisfies readonly EventType[];

export type ActionEventType = (typeof ACTION_EVENT_TYPES)[number];

export function isActionEvent(type: EventType): type is ActionEventType {
  return (ACTION_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * Events a student is allowed to append. Instructor and grading events are
 * written server-side only, after an explicit role check, so a student cannot
 * forge a grade by posting to `/api/events`.
 */
export const STUDENT_WRITABLE_EVENTS: readonly EventType[] = [
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
];
