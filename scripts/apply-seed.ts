/**
 * Pushes the content library to a Supabase project over PostgREST.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run db:apply
 *
 * `npm run db:seed` writes `supabase/seed.sql`, which is what `supabase db
 * reset` consumes locally and what you would review as a diff. This script is
 * the remote equivalent for anyone who does not have psql or a direct database
 * connection to hand - which, on a school-managed Windows laptop, is most
 * people. Same rows, same idempotency, no extra tooling.
 *
 * It needs the service-role key because it writes reference tables that are
 * deliberately read-only to every normal role. Nothing else in the application
 * uses that key.
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

import {
  listAllScenariosIncludingDrafts,
  listMitreTechniques,
  listOwaspCategories,
} from "@/lib/content/fs-loader";
import { BADGE_DEFINITIONS } from "@/lib/grading/engine";
import { PHASE_KEYS } from "@/lib/events/types";
import type { Database } from "@/lib/supabase/database.types";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "The service-role key is in Dashboard > Project Settings > API. Never commit it.",
  );
  process.exit(1);
}

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const LOG_ASSET_TYPE: Record<string, Database["public"]["Enums"]["asset_type"]> = {
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

function fail(step: string, error: { message: string } | null): void {
  if (!error) return;
  console.error(`\n${step} failed: ${error.message}`);
  process.exit(1);
}

async function main() {
  const scenarios = listAllScenariosIncludingDrafts();
  const techniques = listMitreTechniques();
  const owasp = listOwaspCategories();

  process.stdout.write(`Seeding ${new URL(url!).host}\n\n`);

  // ------------------------------------------------------------ reference --
  fail(
    "mitre_techniques",
    (
      await db.from("mitre_techniques").upsert(
        techniques.map((t) => ({
          technique_id: t.technique_id,
          tactic: t.tactic,
          tactic_id: t.tactic_id,
          name: t.name,
          description: t.description,
          url: t.url,
          is_subtechnique: t.is_subtechnique,
          parent_id: t.parent_id,
        })),
        { onConflict: "technique_id" },
      )
    ).error,
  );
  process.stdout.write(`  mitre_techniques    ${techniques.length}\n`);

  fail(
    "owasp_categories",
    (
      await db.from("owasp_categories").upsert(
        owasp.map((c) => ({
          code: c.code,
          name: c.name,
          short_name: c.short_name,
          description: c.description,
          plain_language: c.plain_language,
          url: c.url,
        })),
        { onConflict: "code" },
      )
    ).error,
  );
  process.stdout.write(`  owasp_categories    ${owasp.length}\n`);

  fail(
    "badges",
    (await db.from("badges").upsert(BADGE_DEFINITIONS.map((b) => ({ ...b })), { onConflict: "key" }))
      .error,
  );
  process.stdout.write(`  badges              ${BADGE_DEFINITIONS.length}\n`);

  // ------------------------------------------------------------ scenarios --
  for (const { scenario, alerts, logs, documents } of scenarios) {
    const { data: row, error } = await db
      .from("scenarios")
      .upsert(
        {
          slug: scenario.slug,
          title: scenario.title,
          category: scenario.category,
          difficulty: scenario.difficulty,
          estimated_minutes: scenario.estimated_minutes,
          summary: scenario.summary,
          briefing_md: scenario.briefing_md,
          learning_objectives: scenario.learning_objectives,
          organization_name: scenario.organization,
          root_cause: scenario.root_cause,
          model_recommendations: scenario.model_recommendations,
          continues_from: scenario.continues_from ?? null,
          is_published: scenario.is_published,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .single();

    fail(`scenarios (${scenario.slug})`, error);
    const scenarioId = row!.id;

    // Replace rather than merge: a phase left behind after being removed from
    // the authored file would keep grading students against a dead rule.
    await db.from("scenario_phases").delete().eq("scenario_id", scenarioId);
    fail(
      `scenario_phases (${scenario.slug})`,
      (
        await db.from("scenario_phases").insert(
          scenario.phases.map((phase) => ({
            scenario_id: scenarioId,
            phase_key: phase.key,
            order_index: PHASE_KEYS.indexOf(phase.key),
            title: phase.title,
            instructions_md: phase.instructions_md,
            objectives: phase.objectives,
            spec: {
              decisions: phase.decisions,
              actions: phase.actions,
              hints: phase.hints,
            } as never,
            success_criteria: phase.success_criteria as never,
          })),
        )
      ).error,
    );

    await db.from("scenario_assets").delete().eq("scenario_id", scenarioId);
    const assetRows = [
      ...alerts.map((a) => ({
        scenario_id: scenarioId,
        external_id: a.id,
        asset_type: "ticket" as const,
        content: { kind: "alert", ...a } as never,
        is_decoy: a.is_decoy,
        reveal_phase: a.reveal_phase,
      })),
      ...logs.map((l) => ({
        scenario_id: scenarioId,
        external_id: l.id,
        asset_type: LOG_ASSET_TYPE[l.source] ?? ("ticket" as const),
        content: { kind: "log", ...l } as never,
        is_decoy: l.is_decoy,
        reveal_phase: l.reveal_phase,
      })),
      ...documents.map((d) => ({
        scenario_id: scenarioId,
        external_id: d.id,
        asset_type: d.asset_type,
        content: { kind: "document", ...d } as never,
        is_decoy: d.is_decoy,
        reveal_phase: d.reveal_phase,
      })),
    ];

    // PostgREST rejects very large request bodies; chunk the log-heavy ones.
    for (let i = 0; i < assetRows.length; i += 100) {
      fail(
        `scenario_assets (${scenario.slug})`,
        (await db.from("scenario_assets").insert(assetRows.slice(i, i + 100))).error,
      );
    }

    await db.from("scenario_technique_map").delete().eq("scenario_id", scenarioId);
    fail(
      `scenario_technique_map (${scenario.slug})`,
      (
        await db
          .from("scenario_technique_map")
          .insert(scenario.mitre_techniques.map((t) => ({ scenario_id: scenarioId, technique_id: t })))
      ).error,
    );

    await db.from("scenario_owasp_map").delete().eq("scenario_id", scenarioId);
    if (scenario.owasp_categories.length > 0) {
      fail(
        `scenario_owasp_map (${scenario.slug})`,
        (
          await db
            .from("scenario_owasp_map")
            .insert(scenario.owasp_categories.map((c) => ({ scenario_id: scenarioId, owasp_code: c })))
        ).error,
      );
    }

    process.stdout.write(
      `  ${scenario.slug.padEnd(30)} ${scenario.phases.length} phases, ${assetRows.length} assets\n`,
    );
  }

  process.stdout.write("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
