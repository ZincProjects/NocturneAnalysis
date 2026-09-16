import { z } from "zod";
import { PHASE_KEYS } from "@/lib/events/types";

/**
 * Schema for the file-based scenario definitions under `/content/scenarios`.
 *
 * Scenarios are authored as YAML + JSON fixtures rather than rows in an admin
 * UI so that they stay readable and diffable in git. `npm run content:validate`
 * parses every scenario through this schema in CI, and the seed script refuses
 * to load anything that fails it.
 */

export const phaseKeySchema = z.enum(PHASE_KEYS);

export const severitySchema = z.enum(["critical", "high", "medium", "low", "info"]);

export const iocTypeSchema = z.enum([
  "ip",
  "domain",
  "url",
  "hash",
  "email",
  "user",
  "host",
  "file",
  "registry",
  "process",
]);

export const logSourceSchema = z.enum([
  "firewall",
  "dns",
  "proxy",
  "auth",
  "edr",
  "fileshare",
  "http",
  "mail",
  "backup",
]);

export const assetTypeSchema = z.enum([
  "email",
  "firewall_log",
  "edr_alert",
  "auth_log",
  "dns_log",
  "proxy_log",
  "file_share_log",
  "http_access_log",
  "ransom_note",
  "ticket",
]);

/** A single searchable line in the log/query viewer. */
export const logEntrySchema = z.object({
  id: z.string().min(1),
  ts: z.string().datetime(),
  source: logSourceSchema,
  message: z.string().min(1),
  host: z.string().optional(),
  user: z.string().optional(),
  src_ip: z.string().optional(),
  dst_ip: z.string().optional(),
  domain: z.string().optional(),
  action: z.string().optional(),
  severity: severitySchema.optional(),
  /** Free-form extra columns shown when a student expands the entry. */
  fields: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
  /** Noise. Triage is only a skill when there is something to triage away. */
  is_decoy: z.boolean().default(false),
  /** Phase at which this line becomes visible; defaults to triage. */
  reveal_phase: phaseKeySchema.default("triage"),
});

export type LogEntry = z.infer<typeof logEntrySchema>;

/** Documents (emails, ransom notes, EDR alert JSON) rendered in their own viewer. */
export const documentAssetSchema = z.object({
  id: z.string().min(1),
  asset_type: assetTypeSchema,
  title: z.string().min(1),
  reveal_phase: phaseKeySchema.default("triage"),
  is_decoy: z.boolean().default(false),
  /** Shape depends on asset_type; rendered by a per-type viewer component. */
  content: z.record(z.unknown()),
});

export type DocumentAsset = z.infer<typeof documentAssetSchema>;

export const alertSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: severitySchema,
  source: z.string().min(1),
  first_seen: z.string().datetime(),
  description: z.string().min(1),
  host: z.string().optional(),
  user: z.string().optional(),
  is_decoy: z.boolean().default(false),
  reveal_phase: phaseKeySchema.default("triage"),
  /**
   * Seconds after the session starts before this alert streams into the live
   * feed. 0 means it is present from the first second.
   */
  reveal_after_seconds: z.number().int().min(0).default(0),
  linked_document_ids: z.array(z.string()).default([]),
  linked_log_ids: z.array(z.string()).default([]),
});

export type Alert = z.infer<typeof alertSchema>;

/**
 * The scenario's ground truth for indicators. Entries with
 * `is_malicious: false` are legitimate values that look suspicious - tagging
 * one costs points, which is how the platform teaches false-positive cost.
 */
export const iocSchema = z.object({
  value: z.string().min(1),
  type: iocTypeSchema,
  is_malicious: z.boolean(),
  description: z.string().min(1),
  discoverable_in_phase: phaseKeySchema.default("investigation"),
  points: z.number().int().default(5),
});

export type Ioc = z.infer<typeof iocSchema>;

export const decisionOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

export const decisionSchema = z.object({
  key: z.string().min(1),
  prompt: z.string().min(1),
  help_md: z.string().optional(),
  type: z.enum(["select", "multi_select", "text"]),
  options: z.array(decisionOptionSchema).default([]),
  /** Expected answer(s). Absent for free-text decisions, which are scored by
   *  the instructor rather than the rule engine. */
  expected: z.union([z.string(), z.array(z.string())]).optional(),
  points: z.number().int().default(10),
  /** Shown after the decision is submitted, and quoted in the report. */
  rationale_md: z.string().min(1),
  require_rationale: z.boolean().default(false),
  min_length: z.number().int().optional(),
});

export type DecisionSpec = z.infer<typeof decisionSchema>;

/**
 * A SOC action available in the action panel for a phase. Incorrect actions
 * are intentionally offered (isolating the wrong host, blocking a benign IP)
 * so containment involves a judgement rather than clicking the only button.
 */
export const actionSchema = z.object({
  key: z.string().min(1),
  event_type: z.enum([
    "CONTAIN_HOST",
    "ISOLATE_ACCOUNT",
    "BLOCK_INDICATOR",
    "ESCALATE",
    "DOWNLOAD_ARTIFACT",
  ]),
  label: z.string().min(1),
  target: z.string().min(1),
  description: z.string().min(1),
  is_correct: z.boolean(),
  points: z.number().int().default(10),
  feedback_md: z.string().min(1),
  /** Requires a typed confirmation, mirroring real change-control friction. */
  requires_confirmation: z.boolean().default(false),
});

export type ActionSpec = z.infer<typeof actionSchema>;

export const hintSchema = z.object({
  key: z.string().min(1),
  text_md: z.string().min(1),
  cost: z.number().int().min(0).default(5),
});

export type HintSpec = z.infer<typeof hintSchema>;

export const successCriteriaSchema = z.object({
  required_decision_keys: z.array(z.string()).default([]),
  required_action_keys: z.array(z.string()).default([]),
  required_ioc_values: z.array(z.string()).default([]),
  min_queries: z.number().int().min(0).default(0),
  min_notes: z.number().int().min(0).default(0),
  /** Only meaningful on the lessons_learned phase. */
  require_reflection: z.boolean().default(false),
  reflection_min_words: z.number().int().min(0).default(0),
});

export type SuccessCriteria = z.infer<typeof successCriteriaSchema>;

export const phaseSchema = z.object({
  key: phaseKeySchema,
  title: z.string().min(1),
  instructions_md: z.string().min(1),
  objectives: z.array(z.string()).default([]),
  decisions: z.array(decisionSchema).default([]),
  actions: z.array(actionSchema).default([]),
  hints: z.array(hintSchema).default([]),
  success_criteria: successCriteriaSchema.default({
    required_decision_keys: [],
    required_action_keys: [],
    required_ioc_values: [],
    min_queries: 0,
    min_notes: 0,
    require_reflection: false,
    reflection_min_words: 0,
  }),
});

export type PhaseSpec = z.infer<typeof phaseSchema>;

export const scenarioSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase kebab-case"),
  title: z.string().min(1),
  category: z.enum(["phishing", "network", "web", "ransomware", "insider"]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimated_minutes: z.number().int().positive(),
  summary: z.string().min(1),
  briefing_md: z.string().min(1),
  learning_objectives: z.array(z.string()).min(1),
  organization: z.string().min(1),
  mitre_techniques: z.array(z.string()).min(1),
  owasp_categories: z.array(z.string()).default([]),
  /** Scenario slug this one continues, for multi-part campaigns. */
  continues_from: z.string().optional(),
  is_published: z.boolean().default(true),
  iocs: z.array(iocSchema).min(1),
  phases: z.array(phaseSchema).length(6),
  root_cause: z.string().min(1),
  /** Model answer for the lessons-learned step, shown after submission. */
  model_recommendations: z.array(z.string()).min(1),
});

export type ScenarioSpec = z.infer<typeof scenarioSchema>;

export interface ScenarioBundle {
  scenario: ScenarioSpec;
  alerts: Alert[];
  logs: LogEntry[];
  documents: DocumentAsset[];
}

export const mitreTechniqueSchema = z.object({
  technique_id: z.string(),
  name: z.string(),
  /** Primary tactic, used when a technique needs a single home. */
  tactic: z.string(),
  tactic_id: z.string(),
  /** A technique can sit under several tactics; the heatmap shows it in each. */
  tactics: z.array(z.string()).min(1),
  tactic_ids: z.array(z.string()).min(1),
  url: z.string(),
  description: z.string(),
  is_subtechnique: z.boolean().default(false),
  parent_id: z.string().nullable().default(null),
});

export const mitreTacticSchema = z.object({
  shortname: z.string(),
  name: z.string(),
  tactic_id: z.string(),
});

export type MitreTactic = z.infer<typeof mitreTacticSchema>;

export type MitreTechnique = z.infer<typeof mitreTechniqueSchema>;

export const owaspCategorySchema = z.object({
  code: z.string(),
  name: z.string(),
  short_name: z.string(),
  description: z.string(),
  plain_language: z.string(),
  example: z.string(),
  prevention: z.array(z.string()),
  url: z.string(),
});

export type OwaspCategory = z.infer<typeof owaspCategorySchema>;

/**
 * Cross-file checks the per-object schemas cannot express: every phase key
 * present exactly once and in lifecycle order, success criteria pointing at
 * decisions/actions/IOCs that actually exist, etc.
 */
export function validateScenarioBundle(bundle: ScenarioBundle): string[] {
  const errors: string[] = [];
  const { scenario, alerts, logs, documents } = bundle;
  const where = (msg: string) => `${scenario.slug}: ${msg}`;

  const phaseKeys = scenario.phases.map((p) => p.key);
  PHASE_KEYS.forEach((expected, i) => {
    if (phaseKeys[i] !== expected) {
      errors.push(
        where(`phase ${i} is "${phaseKeys[i]}" but the lifecycle requires "${expected}" at that position`),
      );
    }
  });

  const iocValues = new Set(scenario.iocs.map((i) => i.value));
  const documentIds = new Set(documents.map((d) => d.id));
  const logIds = new Set(logs.map((l) => l.id));

  const seenAlertIds = new Set<string>();
  for (const alert of alerts) {
    if (seenAlertIds.has(alert.id)) errors.push(where(`duplicate alert id "${alert.id}"`));
    seenAlertIds.add(alert.id);
    for (const id of alert.linked_document_ids) {
      if (!documentIds.has(id)) errors.push(where(`alert "${alert.id}" links missing document "${id}"`));
    }
    for (const id of alert.linked_log_ids) {
      if (!logIds.has(id)) errors.push(where(`alert "${alert.id}" links missing log entry "${id}"`));
    }
  }

  for (const phase of scenario.phases) {
    const decisionKeys = new Set(phase.decisions.map((d) => d.key));
    const actionKeys = new Set(phase.actions.map((a) => a.key));

    for (const key of phase.success_criteria.required_decision_keys) {
      if (!decisionKeys.has(key)) {
        errors.push(where(`phase "${phase.key}" requires decision "${key}" which it does not define`));
      }
    }
    for (const key of phase.success_criteria.required_action_keys) {
      if (!actionKeys.has(key)) {
        errors.push(where(`phase "${phase.key}" requires action "${key}" which it does not define`));
      }
    }
    for (const value of phase.success_criteria.required_ioc_values) {
      if (!iocValues.has(value)) {
        errors.push(where(`phase "${phase.key}" requires IOC "${value}" which is not in the scenario's IOC list`));
      }
    }
    for (const decision of phase.decisions) {
      if (decision.type !== "text" && decision.options.length === 0) {
        errors.push(where(`decision "${decision.key}" is a ${decision.type} with no options`));
      }
      if (decision.expected !== undefined) {
        const expectedValues = Array.isArray(decision.expected) ? decision.expected : [decision.expected];
        const optionValues = new Set(decision.options.map((o) => o.value));
        for (const value of expectedValues) {
          if (decision.type !== "text" && !optionValues.has(value)) {
            errors.push(where(`decision "${decision.key}" expects "${value}" which is not one of its options`));
          }
        }
      }
    }
    // Every phase needs at least one gradable interaction or it is unclosable.
    const gate = phase.success_criteria;
    const hasGate =
      gate.required_decision_keys.length > 0 ||
      gate.required_action_keys.length > 0 ||
      gate.required_ioc_values.length > 0 ||
      gate.min_queries > 0 ||
      gate.min_notes > 0 ||
      gate.require_reflection;
    if (!hasGate) {
      errors.push(where(`phase "${phase.key}" has no success criteria, so it can never be gated`));
    }
  }

  if (!scenario.phases.at(-1)?.success_criteria.require_reflection) {
    errors.push(where("the lessons_learned phase must set require_reflection: true"));
  }

  const maliciousIocs = scenario.iocs.filter((i) => i.is_malicious);
  if (maliciousIocs.length === 0) errors.push(where("no malicious IOCs defined"));
  if (scenario.iocs.length === maliciousIocs.length) {
    errors.push(where("every IOC is malicious - add at least one benign lookalike so false positives are possible"));
  }

  if (scenario.category === "web" && scenario.owasp_categories.length === 0) {
    errors.push(where("web scenarios must carry an OWASP Top 10 mapping"));
  }

  return errors;
}
