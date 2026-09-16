import "server-only";

import fs from "node:fs";
import path from "node:path";

import { buildReport, type ReportModel } from "@/lib/report/build";
import {
  getScenarioBundle,
  listMitreTechniques,
  listOwaspCategories,
} from "@/lib/content/loader";
import type { SessionEvent } from "@/lib/events/types";

/**
 * The public sample gallery's data source.
 *
 * Samples are committed event logs, replayed and graded by the same code that
 * handles a real student's session. Nothing here touches the database, so
 * `/samples` works logged out, works with no Supabase project configured, and
 * keeps working during a demo on someone else's wifi - which is the one moment
 * it absolutely must.
 */

export interface SampleSession {
  scenario_slug: string;
  analyst_handle: string;
  organization_name: string;
  events: SessionEvent[];
}

const SAMPLES_DIR = path.join(process.cwd(), "content", "samples");

let cache: SampleSession[] | null = null;

export function listSampleSessions(): SampleSession[] {
  if (cache) return cache;

  if (!fs.existsSync(SAMPLES_DIR)) {
    cache = [];
    return cache;
  }

  cache = fs
    .readdirSync(SAMPLES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), "utf8")) as SampleSession)
    // A sample whose scenario has been removed would crash the gallery.
    .filter((sample) => getScenarioBundle(sample.scenario_slug) !== null);

  return cache;
}

export function getSampleSession(slug: string): SampleSession | null {
  return listSampleSessions().find((s) => s.scenario_slug === slug) ?? null;
}

export async function buildSampleReport(slug: string): Promise<ReportModel | null> {
  const sample = getSampleSession(slug);
  if (!sample) return null;

  const bundle = getScenarioBundle(slug);
  if (!bundle) return null;

  return buildReport({
    sessionId: `sample-${slug}`,
    bundle,
    events: sample.events,
    analystHandle: sample.analyst_handle,
    organizationName: sample.organization_name,
    techniques: listMitreTechniques(),
    owasp: listOwaspCategories().filter((c) => bundle.scenario.owasp_categories.includes(c.code)),
  });
}
