/**
 * Validates everything under `/content` before it can reach a student.
 *
 *   npm run content:validate
 *
 * Three layers of checking, run in CI and by the seed script:
 *   1. Schema - every file parses into the shape the app expects.
 *   2. Consistency - success criteria point at decisions, actions and IOCs
 *      that actually exist; phases are in lifecycle order; every phase has a
 *      gate that can be satisfied.
 *   3. Safety - no address or hostname anywhere in the content resolves to
 *      anything real. This is the check behind the product's central promise
 *      to a school's IT department, so it fails the build, not a warning.
 */

import fs from "node:fs";
import path from "node:path";

import {
  getAttackDataVersion,
  listAllScenariosIncludingDrafts,
  listMitreTactics,
  listMitreTechniques,
  listOwaspCategories,
} from "@/lib/content/fs-loader";
import { scanForUnsafeReferences, type SafetyViolation } from "@/lib/content/safety";
import { PHASE_KEYS } from "@/lib/events/types";

const CONTENT_ROOT = path.join(process.cwd(), "content");

/** Every technique the investigation phase offers must be a real ATT&CK ID. */
const TECHNIQUE_DECISION_KEY = "attack_techniques";

function walkContentFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkContentFiles(full);
    if (/\.(ya?ml|json|md)$/.test(entry.name)) return [full];
    return [];
  });
}

function main() {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ---------------------------------------------------- reference data ----
  const techniques = listMitreTechniques();
  const techniqueIds = new Set(techniques.map((t) => t.technique_id));
  const tactics = listMitreTactics();
  const tacticNames = new Set(tactics.map((t) => t.name));
  const owasp = listOwaspCategories();
  const owaspCodes = new Set(owasp.map((c) => c.code));
  const attackVersion = getAttackDataVersion();

  for (const technique of techniques) {
    for (const tactic of technique.tactics) {
      if (!tacticNames.has(tactic)) {
        errors.push(`MITRE: ${technique.technique_id} sits under unknown tactic "${tactic}"`);
      }
    }
  }

  if (owasp.length !== 10) {
    errors.push(`OWASP: expected 10 categories, found ${owasp.length}`);
  }

  // --------------------------------------------------------- scenarios ----
  // Loading is itself a validation pass: the loader parses against the zod
  // schemas and runs the cross-file consistency checks, throwing on failure.
  let scenarios: ReturnType<typeof listAllScenariosIncludingDrafts> = [];
  try {
    scenarios = listAllScenariosIncludingDrafts();
  } catch (err) {
    console.error(`\nSchema or consistency failure:\n${(err as Error).message}\n`);
    process.exit(1);
  }

  const categories = new Set<string>();

  for (const { scenario } of scenarios) {
    const where = (msg: string) => `${scenario.slug}: ${msg}`;
    categories.add(scenario.category);

    for (const id of scenario.mitre_techniques) {
      if (!techniqueIds.has(id)) {
        errors.push(
          where(`maps to ${id}, which is not in the curated ATT&CK subset. Add it to scripts/build-mitre-data.ts and re-run npm run mitre:build.`),
        );
      }
    }

    for (const code of scenario.owasp_categories) {
      if (!owaspCodes.has(code)) errors.push(where(`maps to unknown OWASP category "${code}"`));
    }

    const investigation = scenario.phases.find((p) => p.key === "investigation");
    const techniqueDecision = investigation?.decisions.find((d) => d.key === TECHNIQUE_DECISION_KEY);

    if (!techniqueDecision) {
      errors.push(
        where(`has no "${TECHNIQUE_DECISION_KEY}" decision in its investigation phase, so the grader cannot measure ATT&CK coverage`),
      );
    } else {
      for (const option of techniqueDecision.options) {
        if (!techniqueIds.has(option.value)) {
          errors.push(where(`technique picker offers "${option.value}", which is not a known ATT&CK ID`));
        }
      }
      const expected = Array.isArray(techniqueDecision.expected)
        ? techniqueDecision.expected
        : techniqueDecision.expected
          ? [techniqueDecision.expected]
          : [];
      const mapped = [...scenario.mitre_techniques].sort().join(",");
      if ([...expected].sort().join(",") !== mapped) {
        errors.push(
          where(`the expected answers of "${TECHNIQUE_DECISION_KEY}" must match the scenario's mitre_techniques exactly (grading reads coverage from this decision)`),
        );
      }
    }

    // A scenario a student cannot finish is worse than no scenario.
    const lessons = scenario.phases.find((p) => p.key === "lessons_learned");
    if (lessons && lessons.success_criteria.reflection_min_words < 50) {
      warnings.push(where("the lessons-learned word minimum is very low; the reflection is the point of the phase"));
    }

    const totalPoints =
      scenario.phases.reduce(
        (sum, p) =>
          sum +
          p.decisions.reduce((s, d) => s + (d.expected ? d.points : 0), 0) +
          p.actions.filter((a) => a.is_correct).reduce((s, a) => s + a.points, 0),
        0,
      ) + scenario.iocs.filter((i) => i.is_malicious).reduce((s, i) => s + i.points, 0);

    if (totalPoints < 50) {
      warnings.push(where(`only ${totalPoints} points are available; the score will not discriminate much`));
    }
  }

  // Requirement: the library spans these attack classes at launch.
  for (const required of ["phishing", "network", "web", "ransomware"]) {
    if (!categories.has(required)) {
      errors.push(`scenario library is missing a "${required}" scenario`);
    }
  }

  // ------------------------------------------------------------ safety ----
  const violations: SafetyViolation[] = [];
  for (const file of walkContentFiles(CONTENT_ROOT)) {
    // The MITRE reference data quotes real adversary infrastructure in its
    // descriptions; it is reference material, not scenario content a student
    // is invited to act on, and it comes from MITRE unmodified.
    if (file.includes(`${path.sep}mitre${path.sep}`)) continue;
    const relative = path.relative(process.cwd(), file);
    violations.push(...scanForUnsafeReferences(fs.readFileSync(file, "utf8"), relative));
  }

  // ------------------------------------------------------------ report ----
  const line = "-".repeat(72);
  process.stdout.write(`\n${line}\nNocturneAnalysis content validation\n${line}\n`);
  process.stdout.write(`  scenarios          ${scenarios.length} (${[...categories].sort().join(", ")})\n`);
  process.stdout.write(`  ATT&CK techniques  ${techniques.length} (v${attackVersion.attack_version})\n`);
  process.stdout.write(`  ATT&CK tactics     ${tactics.length}\n`);
  process.stdout.write(`  OWASP categories   ${owasp.length}\n`);
  process.stdout.write(`  files swept        ${walkContentFiles(CONTENT_ROOT).length}\n`);

  if (violations.length > 0) {
    process.stdout.write(`\nSYNTHETIC DATA VIOLATIONS (${violations.length}):\n`);
    for (const v of violations) {
      process.stdout.write(`  ${v.location}\n    ${v.kind} "${v.value}" - ${v.reason}\n`);
    }
  } else {
    process.stdout.write(`  synthetic data     clean - every address and hostname is in a reserved range\n`);
  }

  if (warnings.length > 0) {
    process.stdout.write(`\nWarnings (${warnings.length}):\n`);
    for (const w of warnings) process.stdout.write(`  - ${w}\n`);
  }

  if (errors.length > 0) {
    process.stdout.write(`\nErrors (${errors.length}):\n`);
    for (const e of errors) process.stdout.write(`  - ${e}\n`);
  }

  const failed = errors.length + violations.length;
  process.stdout.write(`${line}\n${failed === 0 ? "PASS" : `FAIL - ${failed} blocking issue(s)`}\n${line}\n\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
