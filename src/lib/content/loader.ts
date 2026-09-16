import "server-only";

import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import {
  alertSchema,
  documentAssetSchema,
  logEntrySchema,
  mitreTacticSchema,
  mitreTechniqueSchema,
  owaspCategorySchema,
  scenarioSchema,
  validateScenarioBundle,
  type Alert,
  type DocumentAsset,
  type LogEntry,
  type MitreTactic,
  type MitreTechnique,
  type OwaspCategory,
  type ScenarioBundle,
} from "./schema";

/**
 * Reads the version-controlled content in `/content` at request time on the
 * server. Everything here is static and bundled with the deployment - there
 * are no runtime calls to MITRE or OWASP, so a classroom demo on bad wifi
 * behaves exactly like local development.
 *
 * Results are memoised for the lifetime of the server process; content only
 * changes on redeploy.
 */

const CONTENT_ROOT = path.join(process.cwd(), "content");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

let scenarioCache: Map<string, ScenarioBundle> | null = null;

function loadScenarioBundle(slug: string): ScenarioBundle {
  const dir = path.join(CONTENT_ROOT, "scenarios", slug);
  const scenario = scenarioSchema.parse(parseYaml(fs.readFileSync(path.join(dir, "scenario.yaml"), "utf8")));

  const assetsDir = path.join(dir, "assets");
  const alerts = alertSchema.array().parse(readJson<unknown[]>(path.join(assetsDir, "alerts.json")));
  const logs = logEntrySchema.array().parse(readJson<unknown[]>(path.join(assetsDir, "logs.json")));
  const documents = documentAssetSchema
    .array()
    .parse(readJson<unknown[]>(path.join(assetsDir, "documents.json")));

  const bundle: ScenarioBundle = { scenario, alerts, logs, documents };

  const errors = validateScenarioBundle(bundle);
  if (errors.length > 0) {
    throw new Error(`Invalid scenario "${slug}":\n  - ${errors.join("\n  - ")}`);
  }

  // Chronological order is what the log viewer and live feed expect.
  bundle.logs.sort((a, b) => a.ts.localeCompare(b.ts));
  bundle.alerts.sort((a, b) => a.first_seen.localeCompare(b.first_seen));

  return bundle;
}

function loadAllScenarios(): Map<string, ScenarioBundle> {
  if (scenarioCache) return scenarioCache;

  const scenariosDir = path.join(CONTENT_ROOT, "scenarios");
  const slugs = fs
    .readdirSync(scenariosDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const map = new Map<string, ScenarioBundle>();
  for (const slug of slugs) {
    map.set(slug, loadScenarioBundle(slug));
  }
  scenarioCache = map;
  return map;
}

export function getScenarioBundle(slug: string): ScenarioBundle | null {
  return loadAllScenarios().get(slug) ?? null;
}

export function getScenarioBundleOrThrow(slug: string): ScenarioBundle {
  const bundle = getScenarioBundle(slug);
  if (!bundle) throw new Error(`Unknown scenario slug: ${slug}`);
  return bundle;
}

export function listScenarios(): ScenarioBundle[] {
  return [...loadAllScenarios().values()].filter((b) => b.scenario.is_published);
}

export function listAllScenariosIncludingDrafts(): ScenarioBundle[] {
  return [...loadAllScenarios().values()];
}

let mitreCache: MitreTechnique[] | null = null;

export function listMitreTechniques(): MitreTechnique[] {
  if (mitreCache) return mitreCache;
  const file = path.join(CONTENT_ROOT, "mitre", "techniques.json");
  mitreCache = mitreTechniqueSchema.array().parse(readJson<unknown[]>(file));
  return mitreCache;
}

export function getMitreTechnique(id: string): MitreTechnique | null {
  return listMitreTechniques().find((t) => t.technique_id === id) ?? null;
}

let owaspCache: OwaspCategory[] | null = null;

export function listOwaspCategories(): OwaspCategory[] {
  if (owaspCache) return owaspCache;
  const file = path.join(CONTENT_ROOT, "owasp", "top10-2021.json");
  owaspCache = owaspCategorySchema.array().parse(readJson<unknown[]>(file));
  return owaspCache;
}

export function getOwaspCategory(code: string): OwaspCategory | null {
  return listOwaspCategories().find((c) => c.code === code) ?? null;
}

let tacticCache: MitreTactic[] | null = null;

/**
 * Ordered tactic columns for the ATT&CK heatmap, in matrix order as published
 * by MITRE. Read from generated data rather than hardcoded, because ATT&CK
 * reshapes the matrix between versions.
 */
export function listMitreTactics(): MitreTactic[] {
  if (tacticCache) return tacticCache;
  const file = path.join(CONTENT_ROOT, "mitre", "tactics.json");
  tacticCache = mitreTacticSchema.array().parse(readJson<unknown[]>(file));
  return tacticCache;
}

export interface AttackDataVersion {
  attack_version: string;
  generated_at: string;
  technique_count: number;
}

export function getAttackDataVersion(): AttackDataVersion {
  return readJson<AttackDataVersion>(path.join(CONTENT_ROOT, "mitre", "version.json"));
}

export type { Alert, DocumentAsset, LogEntry, MitreTactic, MitreTechnique, OwaspCategory, ScenarioBundle };
