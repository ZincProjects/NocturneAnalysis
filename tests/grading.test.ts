import { describe, expect, it } from "vitest";

import { evaluatePhaseGate, gradeSession } from "@/lib/grading/engine";
import { replaySession } from "@/lib/session/replay";
import type { EventType, PhaseKey, SessionEvent } from "@/lib/events/types";
import type { ScenarioBundle } from "@/lib/content/schema";

/**
 * Grading tests run against a small hand-built scenario rather than a real one,
 * so that a change to authored content cannot make these pass or fail for the
 * wrong reason. The real scenarios are covered by `npm run content:validate`.
 */

let seq = 0;
function event(
  event_type: EventType,
  phase: PhaseKey | null,
  payload: Record<string, unknown>,
): SessionEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    session_id: "s1",
    user_id: "u1",
    event_type,
    phase,
    payload,
    created_at: new Date(Date.parse("2025-01-01T09:00:00.000Z") + seq * 60_000).toISOString(),
    prev_hash: null,
    hash: "x".repeat(64),
    client_meta: null,
  };
}

function emptyPhase(key: PhaseKey) {
  return {
    key,
    title: key,
    instructions_md: "x",
    objectives: [],
    decisions: [],
    actions: [],
    hints: [],
    success_criteria: {
      required_decision_keys: [],
      required_action_keys: [],
      required_ioc_values: [],
      min_queries: 0,
      min_notes: 0,
      require_reflection: false,
      reflection_min_words: 0,
    },
  };
}

const bundle: ScenarioBundle = {
  scenario: {
    slug: "test-scenario",
    title: "Test",
    category: "phishing",
    difficulty: "beginner",
    estimated_minutes: 10,
    summary: "s",
    briefing_md: "b",
    learning_objectives: ["o"],
    organization: "Test Poly",
    mitre_techniques: ["T1566.001", "T1059.001"],
    owasp_categories: [],
    is_published: true,
    root_cause: "rc",
    model_recommendations: ["r"],
    iocs: [
      { value: "bad.example", type: "domain", is_malicious: true, description: "C2", discoverable_in_phase: "investigation", points: 10 },
      { value: "203.0.113.9", type: "ip", is_malicious: true, description: "C2 address", discoverable_in_phase: "investigation", points: 10 },
      { value: "good.example", type: "domain", is_malicious: false, description: "Our own CDN", discoverable_in_phase: "investigation", points: 6 },
    ],
    phases: [
      {
        ...emptyPhase("triage"),
        decisions: [
          {
            key: "severity",
            prompt: "Severity?",
            type: "select",
            options: [
              { value: "high", label: "High" },
              { value: "low", label: "Low" },
            ],
            expected: "high",
            points: 10,
            rationale_md: "because",
            require_rationale: false,
          },
        ],
        actions: [
          {
            key: "escalate",
            event_type: "ESCALATE",
            label: "Escalate",
            target: "Tier 2",
            description: "d",
            is_correct: true,
            points: 10,
            feedback_md: "f",
            requires_confirmation: false,
          },
          {
            key: "close-fp",
            event_type: "ESCALATE",
            label: "Close as false positive",
            target: "alert",
            description: "d",
            is_correct: false,
            points: 15,
            feedback_md: "f",
            requires_confirmation: true,
          },
        ],
        success_criteria: {
          required_decision_keys: ["severity"],
          required_action_keys: ["escalate"],
          required_ioc_values: [],
          min_queries: 1,
          min_notes: 0,
          require_reflection: false,
          reflection_min_words: 0,
        },
      },
      {
        ...emptyPhase("investigation"),
        decisions: [
          {
            key: "attack_techniques",
            prompt: "Techniques?",
            type: "multi_select",
            options: [
              { value: "T1566.001", label: "Phishing" },
              { value: "T1059.001", label: "PowerShell" },
              { value: "T1486", label: "Ransomware" },
            ],
            expected: ["T1566.001", "T1059.001"],
            points: 20,
            rationale_md: "because",
            require_rationale: false,
          },
        ],
        success_criteria: {
          required_decision_keys: ["attack_techniques"],
          required_action_keys: [],
          required_ioc_values: ["bad.example"],
          min_queries: 2,
          min_notes: 1,
          require_reflection: false,
          reflection_min_words: 0,
        },
      },
      emptyPhase("containment"),
      emptyPhase("eradication"),
      emptyPhase("recovery"),
      {
        ...emptyPhase("lessons_learned"),
        success_criteria: {
          required_decision_keys: [],
          required_action_keys: [],
          required_ioc_values: [],
          min_queries: 0,
          min_notes: 0,
          require_reflection: true,
          reflection_min_words: 20,
        },
      },
    ],
  },
  alerts: [],
  logs: [],
  documents: [],
};

const perfectRun: SessionEvent[] = [
  event("SESSION_START", "triage", { scenario_slug: "test-scenario" }),
  event("RUN_QUERY", "triage", { query: "source:edr", result_count: 3 }),
  event("SUBMIT_DECISION", "triage", { decision_key: "severity", decision_value: "high" }),
  event("ESCALATE", "triage", { action_key: "escalate", target: "Tier 2" }),
  event("PHASE_TRANSITION", "investigation", { from: "triage", to: "investigation" }),
  event("RUN_QUERY", "investigation", { query: "source:dns", result_count: 9 }),
  event("RUN_QUERY", "investigation", { query: "source:proxy", result_count: 4 }),
  event("ADD_NOTE", "investigation", { text: "beacon every 60s" }),
  event("TAG_IOC", "investigation", { value: "bad.example", ioc_type: "domain" }),
  event("TAG_IOC", "investigation", { value: "203.0.113.9", ioc_type: "ip" }),
  event("SUBMIT_DECISION", "investigation", {
    decision_key: "attack_techniques",
    decision_value: ["T1566.001", "T1059.001"],
  }),
  event("SUBMIT_REPORT", "lessons_learned", {
    reflection: {
      what_happened: "a ".repeat(15),
      what_worked: "b ".repeat(10),
      what_to_change: "c ".repeat(10),
      // Two controls earns full marks for the reflection; the form shows this
      // threshold to the student rather than leaving it to be discovered.
      recommended_controls: ["Enable attachment detonation", "Quarantine on DMARC failure"],
    },
    executive_summary: "summary",
  }),
];

describe("gradeSession", () => {
  it("awards full marks for a complete, correct run", () => {
    const grade = gradeSession(bundle, replaySession(perfectRun));

    expect(grade.score).toBe(grade.max_score);
    expect(grade.percentage).toBe(100);
    expect(grade.hint_penalty).toBe(0);
    expect(grade.false_positive_penalty).toBe(0);
  });

  it("reads ATT&CK coverage from the student's explicit selection", () => {
    const grade = gradeSession(bundle, replaySession(perfectRun));
    expect(grade.mitre.matched).toEqual(["T1566.001", "T1059.001"]);
    expect(grade.mitre.missed).toEqual([]);
    expect(grade.mitre.false_positives).toEqual([]);
  });

  it("does not credit techniques the student never selected", () => {
    const withoutSelection = perfectRun.filter(
      (e) => (e.payload as { decision_key?: string }).decision_key !== "attack_techniques",
    );
    const grade = gradeSession(bundle, replaySession(withoutSelection));

    expect(grade.mitre.matched).toEqual([]);
    expect(grade.mitre.missed).toEqual(["T1566.001", "T1059.001"]);
  });

  it("flags techniques claimed without evidence", () => {
    const overclaimed = [
      ...perfectRun.filter(
        (e) => (e.payload as { decision_key?: string }).decision_key !== "attack_techniques",
      ),
      event("SUBMIT_DECISION", "investigation", {
        decision_key: "attack_techniques",
        decision_value: ["T1566.001", "T1059.001", "T1486"],
      }),
    ];
    const grade = gradeSession(bundle, replaySession(overclaimed));

    expect(grade.mitre.false_positives).toEqual(["T1486"]);
    // The decision itself is wrong, because the expected set is exact.
    expect(grade.decisions.find((d) => d.decision_key === "attack_techniques")?.correct).toBe(false);
  });

  it("penalises tagging a benign lookalike", () => {
    const withFalsePositive = [
      ...perfectRun,
      event("TAG_IOC", "investigation", { value: "good.example", ioc_type: "domain" }),
    ];
    const grade = gradeSession(bundle, replaySession(withFalsePositive));

    expect(grade.false_positive_penalty).toBe(6);
    expect(grade.score).toBe(grade.max_score - 6);
    expect(grade.iocs.find((i) => i.value === "good.example")?.status).toBe("false_positive");
  });

  it("penalises a value that is not an indicator at all", () => {
    const withInvented = [
      ...perfectRun,
      event("TAG_IOC", "investigation", { value: "invented.example", ioc_type: "domain" }),
    ];
    const grade = gradeSession(bundle, replaySession(withInvented));
    expect(grade.false_positive_penalty).toBe(2);
  });

  it("does not penalise a tag the student withdrew", () => {
    const taggedThenRemoved = [
      ...perfectRun,
      event("TAG_IOC", "investigation", { value: "good.example", ioc_type: "domain" }),
      event("UNTAG_IOC", "investigation", { value: "good.example" }),
    ];
    const grade = gradeSession(bundle, replaySession(taggedThenRemoved));

    expect(grade.false_positive_penalty).toBe(0);
    expect(grade.score).toBe(grade.max_score);
  });

  it("marks a missed indicator without penalising it", () => {
    const missing = perfectRun.filter(
      (e) => (e.payload as { value?: string }).value !== "203.0.113.9",
    );
    const grade = gradeSession(bundle, replaySession(missing));

    expect(grade.iocs.find((i) => i.value === "203.0.113.9")?.status).toBe("missed");
    expect(grade.false_positive_penalty).toBe(0);
    expect(grade.score).toBe(grade.max_score - 10);
  });

  it("subtracts the cost of hints used", () => {
    const withHint = [
      ...perfectRun,
      event("REQUEST_HINT", "investigation", { hint_key: "h1", cost: 5 }),
    ];
    // The hint must exist in the scenario for its cost to count.
    const bundleWithHint: ScenarioBundle = {
      ...bundle,
      scenario: {
        ...bundle.scenario,
        phases: bundle.scenario.phases.map((p) =>
          p.key === "investigation"
            ? { ...p, hints: [{ key: "h1", text_md: "hint", cost: 5 }] }
            : p,
        ),
      },
    };

    const grade = gradeSession(bundleWithHint, replaySession(withHint));
    expect(grade.hint_penalty).toBe(5);
  });

  it("penalises an incorrect response action", () => {
    const withWrongAction = [
      ...perfectRun,
      event("ESCALATE", "triage", { action_key: "close-fp", target: "alert" }),
    ];
    const grade = gradeSession(bundle, replaySession(withWrongAction));

    // Incorrect actions subtract their points and add nothing to the maximum.
    expect(grade.score).toBe(grade.max_score - 15);
    expect(grade.actions.find((a) => a.action_key === "close-fp")?.points_earned).toBe(-15);
  });

  it("never returns a negative score", () => {
    const disastrous = [
      event("SESSION_START", "triage", { scenario_slug: "test-scenario" }),
      event("ESCALATE", "triage", { action_key: "close-fp", target: "alert" }),
      event("TAG_IOC", "investigation", { value: "good.example", ioc_type: "domain" }),
      event("TAG_IOC", "investigation", { value: "nonsense.example", ioc_type: "domain" }),
    ];
    const grade = gradeSession(bundle, replaySession(disastrous));
    expect(grade.score).toBe(0);
  });

  it("awards the reflection only when it meets the word and control minimums", () => {
    const thinReflection = perfectRun.map((e) =>
      e.event_type === "SUBMIT_REPORT"
        ? event("SUBMIT_REPORT", "lessons_learned", {
            reflection: {
              what_happened: "too short",
              what_worked: "",
              what_to_change: "",
              recommended_controls: [],
            },
            executive_summary: "s",
          })
        : e,
    );

    const grade = gradeSession(bundle, replaySession(thinReflection));
    expect(grade.reflection.points_earned).toBe(0);
  });
});

describe("evaluatePhaseGate", () => {
  const triage = bundle.scenario.phases[0];
  const investigation = bundle.scenario.phases[1];

  it("blocks a phase with nothing done", () => {
    const gate = evaluatePhaseGate(triage, replaySession([]), bundle);
    expect(gate.complete).toBe(false);
    expect(gate.items.every((i) => !i.done)).toBe(true);
  });

  it("reports partial progress rather than only pass or fail", () => {
    const partial = replaySession([
      event("SESSION_START", "triage", {}),
      event("SUBMIT_DECISION", "triage", { decision_key: "severity", decision_value: "high" }),
    ]);
    const gate = evaluatePhaseGate(triage, partial, bundle);

    expect(gate.complete).toBe(false);
    expect(gate.items.find((i) => i.label.includes("decisions"))?.done).toBe(true);
    expect(gate.items.find((i) => i.label.includes("Search"))?.done).toBe(false);
  });

  it("opens the phase once every requirement is met", () => {
    const gate = evaluatePhaseGate(triage, replaySession(perfectRun), bundle);
    expect(gate.complete).toBe(true);
  });

  it("counts only queries run during the phase being gated", () => {
    // Two queries, both in triage - investigation still needs its own two.
    const wrongPhase = replaySession([
      event("RUN_QUERY", "triage", { query: "a", result_count: 1 }),
      event("RUN_QUERY", "triage", { query: "b", result_count: 1 }),
    ]);
    const gate = evaluatePhaseGate(investigation, wrongPhase, bundle);
    expect(gate.items.find((i) => i.label.includes("Search"))?.current).toBe(0);
  });

  it("requires the reflection on the final phase", () => {
    const lessons = bundle.scenario.phases[5];
    const gate = evaluatePhaseGate(lessons, replaySession(perfectRun), bundle);
    expect(gate.complete).toBe(true);
  });
});
