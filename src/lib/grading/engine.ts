import type { PhaseKey } from "@/lib/events/types";
import { PHASE_KEYS, PHASE_LABELS } from "@/lib/events/types";
import type { PhaseSpec, ScenarioBundle } from "@/lib/content/schema";
import type { ReplayedSession } from "@/lib/session/replay";

/**
 * Rule-based grading.
 *
 * Every point traces back to a declared expectation in the scenario file
 * (`expected` on a decision, `is_malicious` on an IOC, `is_correct` on an
 * action), never to pattern-matching free text. Free-text rationales and notes
 * are collected and shown to the instructor, but they do not move the machine
 * score - an instructor adjusts the grade if they want to reward them.
 */

export interface ChecklistItem {
  label: string;
  done: boolean;
  current: number;
  required: number;
  /** Detail shown under the item, e.g. which IOC is still missing. */
  hint?: string;
}

export interface PhaseGate {
  phase: PhaseKey;
  complete: boolean;
  items: ChecklistItem[];
}

function asArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function wordCount(text: string | undefined | null): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Whether a phase's minimum work has been done. A phase cannot be left until
 * this returns `complete: true`; the checklist is rendered live in the case
 * panel so the requirement is never a mystery.
 */
export function evaluatePhaseGate(
  phase: PhaseSpec,
  state: ReplayedSession,
  bundle: ScenarioBundle,
): PhaseGate {
  const items: ChecklistItem[] = [];
  const c = phase.success_criteria;

  const submittedKeys = new Set(
    state.decisions.filter((d) => d.phase === phase.key).map((d) => d.decision_key),
  );
  const performedKeys = new Set(
    state.actions.filter((a) => a.phase === phase.key).map((a) => a.action_key),
  );
  const taggedValues = new Set(state.taggedIocs.map((i) => i.value));

  if (c.required_decision_keys.length > 0) {
    const done = c.required_decision_keys.filter((k) => submittedKeys.has(k));
    const outstanding = c.required_decision_keys
      .filter((k) => !submittedKeys.has(k))
      .map((k) => phase.decisions.find((d) => d.key === k)?.prompt ?? k);
    items.push({
      label: "Record the required decisions",
      done: done.length === c.required_decision_keys.length,
      current: done.length,
      required: c.required_decision_keys.length,
      hint: outstanding.length > 0 ? `Outstanding: ${outstanding.join("; ")}` : undefined,
    });
  }

  if (c.required_action_keys.length > 0) {
    const done = c.required_action_keys.filter((k) => performedKeys.has(k));
    const outstanding = c.required_action_keys
      .filter((k) => !performedKeys.has(k))
      .map((k) => phase.actions.find((a) => a.key === k)?.label ?? k);
    items.push({
      label: "Carry out the required response actions",
      done: done.length === c.required_action_keys.length,
      current: done.length,
      required: c.required_action_keys.length,
      hint: outstanding.length > 0 ? `Outstanding: ${outstanding.join("; ")}` : undefined,
    });
  }

  if (c.required_ioc_values.length > 0) {
    const done = c.required_ioc_values.filter((v) => taggedValues.has(v));
    items.push({
      label: "Tag the indicators of compromise",
      done: done.length === c.required_ioc_values.length,
      current: done.length,
      required: c.required_ioc_values.length,
      hint:
        done.length < c.required_ioc_values.length
          ? `${c.required_ioc_values.length - done.length} still to find in the logs.`
          : undefined,
    });
  }

  if (c.min_queries > 0) {
    const runs = state.queries.filter((q) => q.phase === phase.key).length;
    items.push({
      label: "Search the logs",
      done: runs >= c.min_queries,
      current: runs,
      required: c.min_queries,
      hint: "Use the query bar, e.g. `source:dns` or `user:j.tan`.",
    });
  }

  if (c.min_notes > 0) {
    const noteCount = state.notes.filter((n) => n.phase === phase.key).length;
    items.push({
      label: "Write up your working notes",
      done: noteCount >= c.min_notes,
      current: noteCount,
      required: c.min_notes,
    });
  }

  if (c.require_reflection) {
    const r = state.reflection;
    const words =
      wordCount(r?.what_happened) + wordCount(r?.what_worked) + wordCount(r?.what_to_change);
    const controls = r?.recommended_controls?.filter((x) => x.trim().length > 0).length ?? 0;
    items.push({
      label: "Complete the lessons-learned write-up",
      done: words >= c.reflection_min_words && controls >= 1,
      current: words,
      required: c.reflection_min_words,
      hint: controls < 1 ? "Add at least one recommended control." : undefined,
    });
  }

  void bundle;

  return {
    phase: phase.key,
    complete: items.length > 0 && items.every((i) => i.done),
    items,
  };
}

export interface DecisionScore {
  decision_key: string;
  prompt: string;
  phase: PhaseKey;
  given: string[];
  expected: string[] | null;
  given_labels: string[];
  expected_labels: string[];
  correct: boolean | null;
  points_earned: number;
  points_possible: number;
  rationale_md: string;
  student_rationale?: string;
}

export interface IocScore {
  value: string;
  ioc_type: string;
  description: string;
  points: number;
  status: "correct" | "missed" | "false_positive";
}

export interface ActionScore {
  action_key: string;
  label: string;
  target: string;
  phase: PhaseKey;
  taken: boolean;
  is_correct: boolean;
  points_earned: number;
  points_possible: number;
  feedback_md: string;
}

export interface MitreCoverage {
  matched: string[];
  missed: string[];
  false_positives: string[];
}

export interface GradeResult {
  score: number;
  max_score: number;
  percentage: number;
  decisions: DecisionScore[];
  iocs: IocScore[];
  actions: ActionScore[];
  reflection: { points_earned: number; points_possible: number; word_count: number; controls: number };
  hint_penalty: number;
  false_positive_penalty: number;
  mitre: MitreCoverage;
  phase_gates: PhaseGate[];
  badges: string[];
}

const REFLECTION_POINTS = 20;

/**
 * Meeting the stated minimum (word count plus one recommended control) earns
 * the base; each further control earns more, up to full marks.
 *
 * The ramp is deliberate - one recommendation satisfies the phase gate, and
 * an incident review that produces a single action is thin - but it is only
 * fair if the student can see it, so the reflection form shows this threshold
 * rather than leaving them to discover it in the report.
 */
export const REFLECTION_BASE_POINTS = 10;
export const REFLECTION_POINTS_PER_CONTROL = 5;
export const REFLECTION_CONTROLS_FOR_FULL_MARKS = 2;

/**
 * MITRE coverage is taken from the student's explicit technique selection in
 * the investigation phase (decision key `attack_techniques`) rather than being
 * inferred. Inferring it would credit a student for techniques they never
 * recognised, which is exactly what the instructor needs to see.
 */
const TECHNIQUE_DECISION_KEY = "attack_techniques";

export function gradeSession(bundle: ScenarioBundle, state: ReplayedSession): GradeResult {
  const { scenario } = bundle;

  const decisions: DecisionScore[] = [];
  const actions: ActionScore[] = [];
  let hintPenalty = 0;

  for (const phase of scenario.phases) {
    for (const spec of phase.decisions) {
      const submitted = state.decisions.find((d) => d.decision_key === spec.key);
      const given = submitted ? asArray(submitted.decision_value) : [];
      const expected = spec.expected === undefined ? null : asArray(spec.expected);

      let correct: boolean | null = null;
      if (expected) {
        const g = [...given].sort();
        const e = [...expected].sort();
        correct = submitted !== undefined && g.length === e.length && g.every((v, i) => v === e[i]);
      }

      const labelFor = (value: string) =>
        spec.options.find((o) => o.value === value)?.label ?? value;

      decisions.push({
        decision_key: spec.key,
        prompt: spec.prompt,
        phase: phase.key,
        given,
        expected,
        given_labels: given.map(labelFor),
        expected_labels: (expected ?? []).map(labelFor),
        correct,
        points_earned: correct === true ? spec.points : 0,
        points_possible: expected ? spec.points : 0,
        rationale_md: spec.rationale_md,
        student_rationale: submitted?.rationale,
      });
    }

    for (const spec of phase.actions) {
      const taken = state.actions.some((a) => a.action_key === spec.key);
      actions.push({
        action_key: spec.key,
        label: spec.label,
        target: spec.target,
        phase: phase.key,
        taken,
        is_correct: spec.is_correct,
        points_earned: taken ? (spec.is_correct ? spec.points : -spec.points) : 0,
        points_possible: spec.is_correct ? spec.points : 0,
        feedback_md: spec.feedback_md,
      });
    }

    for (const hint of phase.hints) {
      if (state.hints.some((h) => h.hint_key === hint.key)) hintPenalty += hint.cost;
    }
  }

  const taggedValues = new Set(state.taggedIocs.map((i) => i.value));
  const iocs: IocScore[] = [];
  let falsePositivePenalty = 0;

  for (const ioc of scenario.iocs) {
    const tagged = taggedValues.has(ioc.value);
    if (ioc.is_malicious) {
      iocs.push({
        value: ioc.value,
        ioc_type: ioc.type,
        description: ioc.description,
        points: tagged ? ioc.points : 0,
        status: tagged ? "correct" : "missed",
      });
    } else if (tagged) {
      falsePositivePenalty += ioc.points;
      iocs.push({
        value: ioc.value,
        ioc_type: ioc.type,
        description: ioc.description,
        points: -ioc.points,
        status: "false_positive",
      });
    }
  }

  // Values the student invented that are not in the scenario's IOC list at all.
  for (const tag of state.taggedIocs) {
    if (!scenario.iocs.some((i) => i.value === tag.value)) {
      falsePositivePenalty += 2;
      iocs.push({
        value: tag.value,
        ioc_type: tag.ioc_type,
        description: "Not an indicator in this incident.",
        points: -2,
        status: "false_positive",
      });
    }
  }

  const r = state.reflection;
  const reflectionWords =
    wordCount(r?.what_happened) + wordCount(r?.what_worked) + wordCount(r?.what_to_change);
  const controls = r?.recommended_controls?.filter((x) => x.trim().length > 0).length ?? 0;
  const lessonsCriteria = scenario.phases.at(-1)!.success_criteria;
  const reflectionEarned =
    reflectionWords >= lessonsCriteria.reflection_min_words && controls >= 1
      ? Math.min(
          REFLECTION_POINTS,
          REFLECTION_BASE_POINTS + controls * REFLECTION_POINTS_PER_CONTROL,
        )
      : 0;

  const techniqueDecision = state.decisions.find((d) => d.decision_key === TECHNIQUE_DECISION_KEY);
  const selectedTechniques = techniqueDecision ? asArray(techniqueDecision.decision_value) : [];
  const scenarioTechniques = new Set(scenario.mitre_techniques);
  const mitre: MitreCoverage = {
    matched: scenario.mitre_techniques.filter((t) => selectedTechniques.includes(t)),
    missed: scenario.mitre_techniques.filter((t) => !selectedTechniques.includes(t)),
    false_positives: selectedTechniques.filter((t) => !scenarioTechniques.has(t)),
  };

  const positive =
    decisions.reduce((sum, d) => sum + Math.max(0, d.points_earned), 0) +
    actions.reduce((sum, a) => sum + Math.max(0, a.points_earned), 0) +
    iocs.reduce((sum, i) => sum + Math.max(0, i.points), 0) +
    reflectionEarned;

  const maxScore =
    decisions.reduce((sum, d) => sum + d.points_possible, 0) +
    actions.reduce((sum, a) => sum + a.points_possible, 0) +
    scenario.iocs.filter((i) => i.is_malicious).reduce((sum, i) => sum + i.points, 0) +
    REFLECTION_POINTS;

  const penalties =
    hintPenalty +
    falsePositivePenalty +
    actions.reduce((sum, a) => sum + Math.min(0, a.points_earned), 0) * -1;

  const score = Math.max(0, positive - penalties);

  const phaseGates = scenario.phases.map((p) => evaluatePhaseGate(p, state, bundle));

  return {
    score,
    max_score: maxScore,
    percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    decisions,
    iocs,
    actions,
    reflection: {
      points_earned: reflectionEarned,
      points_possible: REFLECTION_POINTS,
      word_count: reflectionWords,
      controls,
    },
    hint_penalty: hintPenalty,
    false_positive_penalty: falsePositivePenalty,
    mitre,
    phase_gates: phaseGates,
    badges: awardBadges(bundle, state, {
      iocs,
      mitre,
      hintPenalty,
      falsePositivePenalty,
    }),
  };
}

interface BadgeContext {
  iocs: IocScore[];
  mitre: MitreCoverage;
  hintPenalty: number;
  falsePositivePenalty: number;
}

export interface BadgeDefinition {
  key: string;
  name: string;
  description: string;
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { key: "first_triage", name: "First Triage", description: "Closed out a triage phase with a recorded severity call." },
  { key: "full_lifecycle", name: "Full Lifecycle", description: "Worked an incident through all six IR phases." },
  { key: "ioc_hunter", name: "IOC Hunter", description: "Found every malicious indicator with no false positives." },
  { key: "unaided", name: "Unaided", description: "Completed a scenario without requesting a single hint." },
  {
    key: "chain_of_custody",
    name: "Chain-of-Custody Master",
    description: "Submitted a report sealed by an intact, verified event hash chain.",
  },
  { key: "attck_analyst", name: "ATT&CK Analyst", description: "Correctly identified every ATT&CK technique in play." },
  { key: "swift_containment", name: "Swift Containment", description: "Contained the incident within 15 minutes of starting." },
  { key: "ransomware_responder", name: "Ransomware Responder", description: "Completed the ransomware outbreak scenario." },
  { key: "soc101_graduate", name: "SOC 101 Graduate", description: "Passed the SOC fundamentals comprehension check." },
];

function awardBadges(
  bundle: ScenarioBundle,
  state: ReplayedSession,
  ctx: BadgeContext,
): string[] {
  const badges: string[] = [];

  if (state.completedPhases.includes("triage")) badges.push("first_triage");
  if (PHASE_KEYS.every((p) => state.completedPhases.includes(p) || state.reportSubmittedAt)) {
    if (state.reportSubmittedAt) badges.push("full_lifecycle");
  }
  if (ctx.iocs.every((i) => i.status === "correct") && ctx.iocs.length > 0) badges.push("ioc_hunter");
  if (state.hints.length === 0 && state.reportSubmittedAt) badges.push("unaided");
  if (state.reportSubmittedAt) badges.push("chain_of_custody");
  if (ctx.mitre.missed.length === 0 && ctx.mitre.false_positives.length === 0 && ctx.mitre.matched.length > 0) {
    badges.push("attck_analyst");
  }

  const firstContainment = state.actions.find((a) => a.phase === "containment");
  if (state.startedAt && firstContainment) {
    const elapsed = Date.parse(firstContainment.performed_at) - Date.parse(state.startedAt);
    if (elapsed <= 15 * 60 * 1000) badges.push("swift_containment");
  }

  if (bundle.scenario.category === "ransomware" && state.reportSubmittedAt) {
    badges.push("ransomware_responder");
  }

  return [...new Set(badges)];
}

export function phaseLabel(phase: PhaseKey): string {
  return PHASE_LABELS[phase];
}
