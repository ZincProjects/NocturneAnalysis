import { describe, expect, it } from "vitest";

import { replaySession, timeToContainMs } from "@/lib/session/replay";
import type { EventType, PhaseKey, SessionEvent } from "@/lib/events/types";

/**
 * The replay is the single source of truth for a session: the console, the
 * instructor's grading view and the generated report are all projections of
 * it. If it drifts, they all drift together and silently.
 */

function at(iso: string) {
  return (
    event_type: EventType,
    phase: PhaseKey | null,
    payload: Record<string, unknown> = {},
  ): SessionEvent => ({
    id: `${iso}-${event_type}`,
    session_id: "s1",
    user_id: "u1",
    event_type,
    phase,
    payload,
    created_at: iso,
    prev_hash: null,
    hash: "y".repeat(64),
    client_meta: null,
  });
}

describe("replaySession", () => {
  it("returns a sane empty state for no events", () => {
    const state = replaySession([]);
    expect(state.startedAt).toBeNull();
    expect(state.currentPhase).toBe("triage");
    expect(state.eventCount).toBe(0);
    expect(state.activeDurationMs).toBe(0);
  });

  it("sorts events by time, not by array order", () => {
    const state = replaySession([
      at("2025-01-01T09:05:00.000Z")("ADD_NOTE", "triage", { text: "second" }),
      at("2025-01-01T09:00:00.000Z")("ADD_NOTE", "triage", { text: "first" }),
    ]);
    expect(state.notes.map((n) => n.text)).toEqual(["first", "second"]);
  });

  it("tracks phase transitions and what has been completed", () => {
    const state = replaySession([
      at("2025-01-01T09:00:00.000Z")("SESSION_START", "triage", { scenario_slug: "x" }),
      at("2025-01-01T09:10:00.000Z")("PHASE_TRANSITION", "investigation", {
        from: "triage",
        to: "investigation",
      }),
      at("2025-01-01T09:30:00.000Z")("PHASE_TRANSITION", "containment", {
        from: "investigation",
        to: "containment",
      }),
    ]);

    expect(state.currentPhase).toBe("containment");
    expect(state.completedPhases).toEqual(["triage", "investigation"]);
  });

  it("keeps completed phases in lifecycle order regardless of transition order", () => {
    const state = replaySession([
      at("2025-01-01T09:10:00.000Z")("PHASE_TRANSITION", "recovery", {
        from: "recovery",
        to: "recovery",
      }),
      at("2025-01-01T09:20:00.000Z")("PHASE_TRANSITION", "investigation", {
        from: "triage",
        to: "investigation",
      }),
    ]);
    expect(state.completedPhases).toEqual(["triage", "recovery"]);
  });

  it("records how long each phase took", () => {
    const state = replaySession([
      at("2025-01-01T09:00:00.000Z")("SESSION_START", "triage", { scenario_slug: "x" }),
      at("2025-01-01T09:10:00.000Z")("PHASE_TRANSITION", "investigation", {
        from: "triage",
        to: "investigation",
      }),
      at("2025-01-01T09:40:00.000Z")("SESSION_COMPLETE", "investigation", {}),
    ]);

    expect(state.phaseTimings[0]).toMatchObject({ phase: "triage", duration_ms: 600_000 });
    expect(state.phaseTimings[1]).toMatchObject({ phase: "investigation", duration_ms: 1_800_000 });
  });

  it("excludes paused time from the active duration", () => {
    const state = replaySession([
      at("2025-01-01T09:00:00.000Z")("SESSION_START", "triage", { scenario_slug: "x" }),
      at("2025-01-01T09:05:00.000Z")("SESSION_PAUSE", "triage", {}),
      at("2025-01-01T09:20:00.000Z")("SESSION_RESUME", "triage", {}),
      at("2025-01-01T09:25:00.000Z")("SESSION_COMPLETE", "triage", {}),
    ]);

    // 25 minutes elapsed, 15 of them paused.
    expect(state.activeDurationMs).toBe(10 * 60_000);
  });

  it("keeps only the latest submission for a decision key", () => {
    const state = replaySession([
      at("2025-01-01T09:00:00.000Z")("SUBMIT_DECISION", "triage", {
        decision_key: "severity",
        decision_value: "low",
      }),
      at("2025-01-01T09:01:00.000Z")("SUBMIT_DECISION", "triage", {
        decision_key: "severity",
        decision_value: "high",
      }),
    ]);

    expect(state.decisions).toHaveLength(1);
    expect(state.decisions[0].decision_value).toBe("high");
  });

  it("removes an untagged indicator entirely", () => {
    const state = replaySession([
      at("2025-01-01T09:00:00.000Z")("TAG_IOC", "investigation", { value: "a.example", ioc_type: "domain" }),
      at("2025-01-01T09:01:00.000Z")("TAG_IOC", "investigation", { value: "b.example", ioc_type: "domain" }),
      at("2025-01-01T09:02:00.000Z")("UNTAG_IOC", "investigation", { value: "a.example" }),
    ]);

    expect(state.taggedIocs.map((i) => i.value)).toEqual(["b.example"]);
  });

  it("re-tagging after untagging restores the indicator", () => {
    const state = replaySession([
      at("2025-01-01T09:00:00.000Z")("TAG_IOC", "investigation", { value: "a.example", ioc_type: "domain" }),
      at("2025-01-01T09:01:00.000Z")("UNTAG_IOC", "investigation", { value: "a.example" }),
      at("2025-01-01T09:02:00.000Z")("TAG_IOC", "containment", { value: "a.example", ioc_type: "domain" }),
    ]);

    expect(state.taggedIocs).toHaveLength(1);
    expect(state.taggedIocs[0].phase).toBe("containment");
  });

  it("deduplicates viewed alerts and log entries", () => {
    const state = replaySession([
      at("2025-01-01T09:00:00.000Z")("VIEW_ALERT", "triage", { alert_id: "a1", severity: "high" }),
      at("2025-01-01T09:01:00.000Z")("VIEW_ALERT", "triage", { alert_id: "a1", severity: "high" }),
      at("2025-01-01T09:02:00.000Z")("VIEW_LOG_ENTRY", "triage", { log_id: "l1", source: "dns" }),
    ]);

    expect(state.viewedAlertIds).toEqual(["a1"]);
    expect(state.viewedLogIds).toEqual(["l1"]);
  });

  it("collects response actions with the phase they were taken in", () => {
    const state = replaySession([
      at("2025-01-01T09:00:00.000Z")("CONTAIN_HOST", "containment", {
        action_key: "isolate",
        target: "WKS-1",
      }),
      at("2025-01-01T09:01:00.000Z")("BLOCK_INDICATOR", "containment", {
        action_key: "block",
        target: "bad.example",
      }),
    ]);

    expect(state.actions).toHaveLength(2);
    expect(state.actions[0]).toMatchObject({ action_key: "isolate", phase: "containment" });
  });

  it("captures the reflection and instructor activity", () => {
    const state = replaySession([
      at("2025-01-01T09:00:00.000Z")("SUBMIT_REPORT", "lessons_learned", {
        reflection: {
          what_happened: "x",
          what_worked: "y",
          what_to_change: "z",
          recommended_controls: ["a"],
        },
        executive_summary: "summary",
      }),
      at("2025-01-01T10:00:00.000Z")("INSTRUCTOR_COMMENT", null, {
        comment: "Good containment reasoning",
        instructor_handle: "lead.analyst",
      }),
      at("2025-01-01T10:01:00.000Z")("GRADE_ASSIGNED", null, { score: 90, max_score: 100 }),
    ]);

    expect(state.reflection?.recommended_controls).toEqual(["a"]);
    expect(state.executiveSummary).toBe("summary");
    expect(state.instructorComments).toHaveLength(1);
    expect(state.assignedGrade).toMatchObject({ score: 90, max_score: 100 });
  });

  it("falls back to the current phase when an event has none", () => {
    const state = replaySession([
      at("2025-01-01T09:00:00.000Z")("PHASE_TRANSITION", "investigation", {
        from: "triage",
        to: "investigation",
      }),
      at("2025-01-01T09:01:00.000Z")("ADD_NOTE", null, { text: "unphased" }),
    ]);

    expect(state.notes[0].phase).toBe("investigation");
  });
});

describe("timeToContainMs", () => {
  it("measures from session start to the first containment action", () => {
    const state = replaySession([
      at("2025-01-01T09:00:00.000Z")("SESSION_START", "triage", { scenario_slug: "x" }),
      at("2025-01-01T09:18:00.000Z")("CONTAIN_HOST", "containment", {
        action_key: "isolate",
        target: "WKS-1",
      }),
      at("2025-01-01T09:25:00.000Z")("BLOCK_INDICATOR", "containment", {
        action_key: "block",
        target: "bad.example",
      }),
    ]);

    expect(timeToContainMs(state)).toBe(18 * 60_000);
  });

  it("returns null when nothing was contained", () => {
    const state = replaySession([
      at("2025-01-01T09:00:00.000Z")("SESSION_START", "triage", { scenario_slug: "x" }),
    ]);
    expect(timeToContainMs(state)).toBeNull();
  });
});
