/**
 * Turns the file-based content library into database rows.
 *
 *   npm run db:seed              # write supabase/seed.sql
 *   npm run db:seed -- --apply   # ...and push it straight to the project
 *
 * Why a generated .sql file rather than a script that just writes rows:
 *
 *   * `supabase db reset` applies `supabase/seed.sql` automatically, so local
 *     development gets the whole library with one command and no extra step.
 *   * The output is reviewable. A seed that silently rewrites production
 *     content is exactly the kind of thing you want to read as a diff first.
 *   * It needs no service-role key to produce, so it is safe to run in CI.
 *
 * The generated SQL is idempotent: it upserts scenarios by slug and replaces
 * their phases and assets, so re-running after editing a scenario file updates
 * the database in place without touching any student session that references
 * the scenario.
 */

import fs from "node:fs";
import path from "node:path";

import {
  listAllScenariosIncludingDrafts,
  listMitreTechniques,
  listOwaspCategories,
} from "@/lib/content/fs-loader";
import { BADGE_DEFINITIONS } from "@/lib/grading/engine";
import { PHASE_KEYS } from "@/lib/events/types";
import type { ScenarioBundle } from "@/lib/content/schema";

const OUT_FILE = path.join(process.cwd(), "supabase", "seed.sql");

/** Postgres string literal. Doubling the quote is the only escape needed. */
function lit(value: string | null | undefined): string {
  if (value === null || value === undefined) return "null";
  return `'${value.replace(/'/g, "''")}'`;
}

function jsonLit(value: unknown): string {
  return `${lit(JSON.stringify(value))}::jsonb`;
}

function textArrayLit(values: string[]): string {
  if (values.length === 0) return "'{}'::text[]";
  return `array[${values.map(lit).join(", ")}]::text[]`;
}

/** Maps a scenario asset to the database's asset_type enum. */
function logAssetType(source: string): string {
  const map: Record<string, string> = {
    firewall: "firewall_log",
    dns: "dns_log",
    proxy: "proxy_log",
    auth: "auth_log",
    edr: "edr_alert",
    fileshare: "file_share_log",
    http: "http_access_log",
    mail: "email",
    backup: "auth_log",
  };
  return map[source] ?? "ticket";
}

function scenarioSql(bundle: ScenarioBundle): string {
  const { scenario, alerts, logs, documents } = bundle;
  const out: string[] = [];

  out.push(`-- ${"-".repeat(66)}`);
  out.push(`-- ${scenario.title}`);
  out.push(`-- ${"-".repeat(66)}`);

  out.push(`insert into scenarios (
  slug, title, category, difficulty, estimated_minutes, summary, briefing_md,
  learning_objectives, organization_name, root_cause, model_recommendations,
  continues_from, is_published
) values (
  ${lit(scenario.slug)}, ${lit(scenario.title)}, ${lit(scenario.category)}::scenario_category,
  ${lit(scenario.difficulty)}::scenario_difficulty, ${scenario.estimated_minutes},
  ${lit(scenario.summary)}, ${lit(scenario.briefing_md)},
  ${textArrayLit(scenario.learning_objectives)}, ${lit(scenario.organization)},
  ${lit(scenario.root_cause)}, ${textArrayLit(scenario.model_recommendations)},
  ${lit(scenario.continues_from ?? null)}, ${scenario.is_published}
)
on conflict (slug) do update set
  title = excluded.title,
  category = excluded.category,
  difficulty = excluded.difficulty,
  estimated_minutes = excluded.estimated_minutes,
  summary = excluded.summary,
  briefing_md = excluded.briefing_md,
  learning_objectives = excluded.learning_objectives,
  organization_name = excluded.organization_name,
  root_cause = excluded.root_cause,
  model_recommendations = excluded.model_recommendations,
  continues_from = excluded.continues_from,
  is_published = excluded.is_published;`);

  // Phases and assets are fully replaced rather than merged: the authored file
  // is the source of truth, and a stale phase left behind would silently keep
  // grading students against a rule that no longer exists.
  out.push(
    `delete from scenario_phases where scenario_id = (select id from scenarios where slug = ${lit(scenario.slug)});`,
  );

  for (const phase of scenario.phases) {
    const spec = {
      decisions: phase.decisions,
      actions: phase.actions,
      hints: phase.hints,
    };
    out.push(`insert into scenario_phases (
  scenario_id, phase_key, order_index, title, instructions_md, objectives, spec, success_criteria
) values (
  (select id from scenarios where slug = ${lit(scenario.slug)}),
  ${lit(phase.key)}::phase_key, ${PHASE_KEYS.indexOf(phase.key)},
  ${lit(phase.title)}, ${lit(phase.instructions_md)}, ${textArrayLit(phase.objectives)},
  ${jsonLit(spec)}, ${jsonLit(phase.success_criteria)}
);`);
  }

  out.push(
    `delete from scenario_assets where scenario_id = (select id from scenarios where slug = ${lit(scenario.slug)});`,
  );

  const assetRows: string[] = [];

  for (const alert of alerts) {
    assetRows.push(
      `((select id from scenarios where slug = ${lit(scenario.slug)}), ${lit(alert.id)}, 'ticket'::asset_type, ${jsonLit({ kind: "alert", ...alert })}, ${alert.is_decoy}, ${lit(alert.reveal_phase)}::phase_key)`,
    );
  }
  for (const log of logs) {
    assetRows.push(
      `((select id from scenarios where slug = ${lit(scenario.slug)}), ${lit(log.id)}, ${lit(logAssetType(log.source))}::asset_type, ${jsonLit({ kind: "log", ...log })}, ${log.is_decoy}, ${lit(log.reveal_phase)}::phase_key)`,
    );
  }
  for (const doc of documents) {
    assetRows.push(
      `((select id from scenarios where slug = ${lit(scenario.slug)}), ${lit(doc.id)}, ${lit(doc.asset_type)}::asset_type, ${jsonLit({ kind: "document", ...doc })}, ${doc.is_decoy}, ${lit(doc.reveal_phase)}::phase_key)`,
    );
  }

  // Chunked so a scenario with hundreds of log lines does not become one
  // statement too large to read or to fail usefully.
  for (let i = 0; i < assetRows.length; i += 50) {
    out.push(
      `insert into scenario_assets (scenario_id, external_id, asset_type, content, is_decoy, reveal_phase) values\n${assetRows.slice(i, i + 50).join(",\n")};`,
    );
  }

  out.push(
    `delete from scenario_technique_map where scenario_id = (select id from scenarios where slug = ${lit(scenario.slug)});`,
  );
  if (scenario.mitre_techniques.length > 0) {
    out.push(
      `insert into scenario_technique_map (scenario_id, technique_id) values\n${scenario.mitre_techniques
        .map((t) => `((select id from scenarios where slug = ${lit(scenario.slug)}), ${lit(t)})`)
        .join(",\n")};`,
    );
  }

  out.push(
    `delete from scenario_owasp_map where scenario_id = (select id from scenarios where slug = ${lit(scenario.slug)});`,
  );
  if (scenario.owasp_categories.length > 0) {
    out.push(
      `insert into scenario_owasp_map (scenario_id, owasp_code) values\n${scenario.owasp_categories
        .map((c) => `((select id from scenarios where slug = ${lit(scenario.slug)}), ${lit(c)})`)
        .join(",\n")};`,
    );
  }

  return out.join("\n\n");
}

function main() {
  const scenarios = listAllScenariosIncludingDrafts();
  const techniques = listMitreTechniques();
  const owasp = listOwaspCategories();

  const parts: string[] = [];

  parts.push(`-- GENERATED FILE - do not edit.
--
-- Produced by \`npm run db:seed\` from the content library in /content.
-- Edit the scenario YAML and asset JSON there and regenerate.
--
-- Applied automatically by \`supabase db reset\`.

begin;`);

  // ------------------------------------------------------------ reference --
  parts.push(`-- MITRE ATT&CK reference subset`);
  parts.push(
    `insert into mitre_techniques (technique_id, tactic, tactic_id, name, description, url, is_subtechnique, parent_id) values\n${techniques
      .map(
        (t) =>
          `(${lit(t.technique_id)}, ${lit(t.tactic)}, ${lit(t.tactic_id)}, ${lit(t.name)}, ${lit(t.description)}, ${lit(t.url)}, ${t.is_subtechnique}, ${lit(t.parent_id)})`,
      )
      .join(",\n")}
on conflict (technique_id) do update set
  tactic = excluded.tactic,
  tactic_id = excluded.tactic_id,
  name = excluded.name,
  description = excluded.description,
  url = excluded.url,
  is_subtechnique = excluded.is_subtechnique,
  parent_id = excluded.parent_id;`,
  );

  parts.push(`-- OWASP Top 10:2021`);
  parts.push(
    `insert into owasp_categories (code, name, short_name, description, plain_language, url) values\n${owasp
      .map(
        (c) =>
          `(${lit(c.code)}, ${lit(c.name)}, ${lit(c.short_name)}, ${lit(c.description)}, ${lit(c.plain_language)}, ${lit(c.url)})`,
      )
      .join(",\n")}
on conflict (code) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  description = excluded.description,
  plain_language = excluded.plain_language,
  url = excluded.url;`,
  );

  parts.push(`-- Badges`);
  parts.push(
    `insert into badges (key, name, description) values\n${BADGE_DEFINITIONS.map(
      (b) => `(${lit(b.key)}, ${lit(b.name)}, ${lit(b.description)})`,
    ).join(",\n")}
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description;`,
  );

  // ------------------------------------------------------------ scenarios --
  for (const bundle of scenarios) {
    parts.push(scenarioSql(bundle));
  }

  parts.push("commit;");

  const sql = `${parts.join("\n\n")}\n`;
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, sql, "utf8");

  const kb = (Buffer.byteLength(sql, "utf8") / 1024).toFixed(1);
  process.stdout.write(
    `Wrote ${path.relative(process.cwd(), OUT_FILE)} (${kb} KB)\n` +
      `  ${scenarios.length} scenarios, ${techniques.length} techniques, ${owasp.length} OWASP categories, ${BADGE_DEFINITIONS.length} badges\n` +
      `\nApply it with either:\n` +
      `  supabase db reset                        (local, also replays migrations)\n` +
      `  psql "$DATABASE_URL" -f supabase/seed.sql (remote)\n`,
  );
}

main();
