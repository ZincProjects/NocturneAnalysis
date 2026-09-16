/**
 * Generates the demo sessions behind the public `/samples` gallery.
 *
 *   npm run samples:build
 *
 * Each sample is a complete, hash-chained event log for one scenario, written
 * to `content/samples/<slug>.json` and committed. The gallery replays and
 * grades them exactly as it would a real student's session, so what a
 * prospective school sees is a genuine report produced by the real pipeline,
 * not a mock-up that will drift from the product.
 *
 * Why files rather than seeded database rows, which was the original plan:
 *
 *   * `/samples` is the page you show a school before they have a single
 *     student enrolled. It should not depend on a database being reachable,
 *     seeded and correctly configured - the one moment it must not fail is a
 *     live pitch on someone else's wifi.
 *   * The samples are pitch collateral. Version-controlling them means a
 *     change to one is reviewable in a diff, and the gallery cannot quietly
 *     differ between environments.
 *   * They are deterministic, so a screenshot in a proposal stays accurate.
 *
 * The runs are deliberately imperfect. A sample where the analyst scores 100%
 * teaches a viewer nothing about how the platform handles a missed indicator
 * or a false positive, which is exactly what an evaluator wants to see.
 */

import fs from "node:fs";
import path from "node:path";

import { computeEventHash } from "@/lib/events/hash";
import { PHASE_KEYS, type EventType, type PhaseKey, type SessionEvent } from "@/lib/events/types";
import type { SessionReflection } from "@/lib/events/payloads";
import { listAllScenariosIncludingDrafts } from "@/lib/content/fs-loader";
import type { ScenarioBundle } from "@/lib/content/schema";

const OUT_DIR = path.join(process.cwd(), "content", "samples");

/** How well the fictional analyst performed, per scenario. */
interface SampleProfile {
  handle: string;
  /** Malicious IOCs to leave untagged. */
  missIocs: number;
  /** Tag this many benign lookalikes, costing points. */
  falsePositives: number;
  /** Decision keys to answer incorrectly. */
  wrongDecisions: string[];
  /** Hint keys the analyst asked for. */
  hints: string[];
  /** Seconds of realistic dithering between actions. */
  pace: number;
  reflection: SessionReflection;
  startedAt: string;
}

const PROFILES: Record<string, SampleProfile> = {
  "phishing-initial-access": {
    handle: "night.owl",
    missIocs: 0,
    falsePositives: 0,
    wrongDecisions: [],
    hints: ["inv-hint-beacon"],
    pace: 42,
    startedAt: "2025-05-06T09:12:00.000Z",
    reflection: {
      what_happened:
        "A member of HR staff received a payroll-themed email from a lookalike domain that failed both SPF and DMARC. The mail gateway was configured to tag rather than quarantine on authentication failure, so it was delivered. The attachment was a Windows shortcut using a double extension to appear as a PDF; opening it launched PowerShell with a hidden window and a base64-encoded command, which downloaded a second-stage implant and wrote it into AppData. The implant established Run-key persistence and began beaconing to a command-and-control domain registered six days earlier, at a steady sixty-second interval. Separately, and before the attachment was opened, the same user submitted their credentials to a fake single sign-on page linked from the same email, so the account was compromised independently of the endpoint.",
      what_worked:
        "The endpoint agent's behavioural rule fired within seconds of PowerShell being spawned by Outlook, which is the detection that gave us the incident at all - signature-based antivirus never saw the payload. The user also phoned the Service Desk about the email before anyone contacted her, which meant we had her account of events early. Network telemetry let us confirm the beacon independently of the endpoint, so the finding did not rest on a single source.",
      what_to_change:
        "The gateway decision is the one that mattered: a message failing DMARC from a domain imitating our own should not reach a mailbox. Shortcut and script attachments were not being detonated, only Office documents and PDFs, which is why a .lnk walked through. An attack-surface-reduction rule blocking Office applications from creating child processes would have stopped the chain before any network activity. Finally, the harvested password would have been useless against phishing-resistant MFA, and we should stop treating the endpoint and the identity as the same incident boundary.",
      recommended_controls: [
        "Quarantine rather than tag inbound mail that fails DMARC, and alert the SOC on external senders using a lookalike of the institution's domain",
        "Enable attachment detonation for shortcut and script file types (.lnk, .js, .hta, .iso), not only Office documents and PDFs",
        "Deploy the ASR rule blocking Office applications from creating child processes",
        "Enforce phishing-resistant MFA on staff accounts so a harvested password alone grants nothing",
      ],
    },
  },
};

/** Fallback for scenarios without a hand-written profile. */
function defaultProfile(bundle: ScenarioBundle): SampleProfile {
  return {
    handle: "sample.analyst",
    missIocs: 1,
    falsePositives: 1,
    wrongDecisions: [],
    hints: [],
    pace: 50,
    startedAt: "2025-05-07T10:00:00.000Z",
    reflection: {
      what_happened: `A ${bundle.scenario.category} incident affecting ${bundle.scenario.organization}. ${bundle.scenario.root_cause}`,
      what_worked:
        "Detection telemetry gave us the incident early enough to contain it before the attacker achieved their objective, and the evidence available was sufficient to establish the root cause without guesswork.",
      what_to_change:
        "The controls that failed are the ones closest to the initial access, and fixing those is worth more than adding another layer of detection further down the chain.",
      recommended_controls: bundle.scenario.model_recommendations.slice(0, 3),
    },
  };
}

class SampleSessionBuilder {
  private events: SessionEvent[] = [];
  private prevHash = "";
  private clock: number;
  private readonly sessionId: string;
  private readonly userId: string;
  private readonly pace: number;

  constructor(sessionId: string, userId: string, startedAt: string, pace: number) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.clock = Date.parse(startedAt);
    this.pace = pace;
  }

  /** Advances the clock by a plausible, deterministic amount. */
  private tick(weight = 1): string {
    // Deterministic jitter: samples must be byte-identical between runs or the
    // committed fixture churns on every build.
    const jitter = ((this.events.length * 37) % 23) - 11;
    this.clock += Math.max(3, Math.round(this.pace * weight + jitter)) * 1000;
    return new Date(this.clock).toISOString();
  }

  async add(
    eventType: EventType,
    phase: PhaseKey | null,
    payload: Record<string, unknown>,
    weight = 1,
  ): Promise<void> {
    const createdAt = this.tick(weight);
    const hash = await computeEventHash({
      prevHash: this.prevHash,
      eventType,
      payload,
      createdAt,
    });

    this.events.push({
      id: `${this.sessionId}-${String(this.events.length + 1).padStart(4, "0")}`,
      session_id: this.sessionId,
      user_id: this.userId,
      event_type: eventType,
      phase,
      payload,
      created_at: createdAt,
      prev_hash: this.prevHash,
      hash,
      client_meta: null,
    });

    this.prevHash = hash;
  }

  build(): SessionEvent[] {
    return this.events;
  }
}

async function buildSample(bundle: ScenarioBundle, profile: SampleProfile): Promise<SessionEvent[]> {
  const { scenario } = bundle;
  const sessionId = `sample-${scenario.slug}`;
  const builder = new SampleSessionBuilder(sessionId, `sample-user-${scenario.slug}`, profile.startedAt, profile.pace);

  await builder.add("SESSION_START", "triage", { scenario_slug: scenario.slug, resumed: false }, 0.2);

  const maliciousIocs = scenario.iocs.filter((i) => i.is_malicious);
  const benignIocs = scenario.iocs.filter((i) => !i.is_malicious);
  const taggedIocs = maliciousIocs.slice(0, maliciousIocs.length - profile.missIocs);
  const falsePositives = benignIocs.slice(0, profile.falsePositives);

  for (const phaseIndex of PHASE_KEYS.keys()) {
    const phaseKey = PHASE_KEYS[phaseIndex];
    const phase = scenario.phases.find((p) => p.key === phaseKey);
    if (!phase) continue;

    if (phaseIndex > 0) {
      await builder.add(
        "PHASE_TRANSITION",
        phaseKey,
        { from: PHASE_KEYS[phaseIndex - 1], to: phaseKey },
        0.5,
      );
    }

    // Reading the queue and the evidence attached to it.
    if (phaseKey === "triage") {
      for (const alert of bundle.alerts.filter((a) => !a.is_decoy && a.reveal_after_seconds === 0)) {
        await builder.add("VIEW_ALERT", phaseKey, { alert_id: alert.id, severity: alert.severity }, 0.6);
      }
    }

    // Enough searching to satisfy the gate, plus the pivots a real analyst runs.
    const minQueries = Math.max(phase.success_criteria.min_queries, phaseKey === "investigation" ? 4 : 0);
    const queryPool =
      phaseKey === "investigation"
        ? [
            `host:${bundle.logs.find((l) => l.host)?.host ?? "unknown"}`,
            "source:dns",
            "source:proxy",
            "source:edr",
            "source:auth",
          ]
        : ["source:edr", "source:dns"];

    for (let i = 0; i < minQueries; i += 1) {
      const query = queryPool[i % queryPool.length];
      const matches = bundle.logs.filter(
        (l) => l.message.includes(query.split(":")[1] ?? "") || l.source === query.split(":")[1],
      ).length;
      await builder.add("RUN_QUERY", phaseKey, { query, result_count: matches, filters: {} }, 0.8);
    }

    if (phaseKey === "investigation") {
      for (const log of bundle.logs.filter((l) => !l.is_decoy).slice(0, 6)) {
        await builder.add("VIEW_LOG_ENTRY", phaseKey, { log_id: log.id, source: log.source }, 0.4);
      }
      for (const ioc of taggedIocs) {
        await builder.add("TAG_IOC", phaseKey, { value: ioc.value, ioc_type: ioc.type }, 0.7);
      }
      for (const ioc of falsePositives) {
        await builder.add("TAG_IOC", phaseKey, { value: ioc.value, ioc_type: ioc.type }, 0.7);
      }
    }

    for (const hint of phase.hints) {
      if (profile.hints.includes(hint.key)) {
        await builder.add("REQUEST_HINT", phaseKey, { hint_key: hint.key, cost: hint.cost }, 0.5);
      }
    }

    for (let i = 0; i < phase.success_criteria.min_notes; i += 1) {
      await builder.add(
        "ADD_NOTE",
        phaseKey,
        {
          text: `${phase.title}: working through the evidence and recording what it supports before moving on.`,
        },
        1.2,
      );
    }

    for (const decision of phase.decisions) {
      const expected = decision.expected;
      const wrong = profile.wrongDecisions.includes(decision.key);

      let value: string | string[];
      if (expected === undefined) {
        value = decision.options[0]?.value ?? "";
      } else if (!wrong) {
        value = expected;
      } else {
        // A plausible wrong answer, not a random one.
        const expectedSet = new Set(Array.isArray(expected) ? expected : [expected]);
        const alternative = decision.options.find((o) => !expectedSet.has(o.value));
        value = Array.isArray(expected)
          ? [...(expected as string[]).slice(0, -1), alternative?.value ?? ""].filter(Boolean)
          : (alternative?.value ?? "");
      }

      await builder.add(
        "SUBMIT_DECISION",
        phaseKey,
        {
          decision_key: decision.key,
          decision_value: value,
          rationale: decision.require_rationale
            ? sampleRationale(decision.key, bundle)
            : undefined,
        },
        1.6,
      );
    }

    for (const action of phase.actions) {
      if (!action.is_correct) continue;
      await builder.add(
        action.event_type,
        phaseKey,
        { action_key: action.key, target: action.target },
        1.1,
      );
    }
  }

  await builder.add(
    "SUBMIT_REPORT",
    "lessons_learned",
    {
      reflection: profile.reflection,
      executive_summary: profile.reflection.what_happened,
    },
    2,
  );
  await builder.add("SESSION_COMPLETE", "lessons_learned", { total_phases: 6 }, 0.2);

  return builder.build();
}

const RATIONALES: Record<string, string> = {
  alert_severity:
    "One staff endpoint with near-certain code execution, but no evidence yet of a second host or of anything touching student records. High rather than critical - I would raise it the moment the blast radius grows.",
  alert_confidence:
    "Strong indicator from one telemetry source plus a matching account from the user. That is more than uncertain, but it is not corroborated yet, so not confirmed.",
  root_cause:
    "Every later step depends on the attachment reaching a mailbox and being executed. The controls failed before the user was ever involved.",
  containment_approach:
    "Isolating from the EDR console cuts the C2 channel but leaves memory intact, which is the only place the unencrypted payload exists. Pulling power would destroy the evidence we need to answer what was taken.",
  primary_control_gap:
    "The gateway is the earliest point where one configuration change stops the whole chain. The other gaps are real but further down and harder to close without breaking legitimate work.",
};

function sampleRationale(key: string, bundle: ScenarioBundle): string {
  return (
    RATIONALES[key] ??
    `Recorded during the ${bundle.scenario.category} incident based on the evidence available at this point in the investigation.`
  );
}

async function main() {
  const scenarios = listAllScenariosIncludingDrafts();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const bundle of scenarios) {
    const profile = PROFILES[bundle.scenario.slug] ?? defaultProfile(bundle);
    const events = await buildSample(bundle, profile);

    const file = path.join(OUT_DIR, `${bundle.scenario.slug}.json`);
    fs.writeFileSync(
      file,
      `${JSON.stringify(
        {
          scenario_slug: bundle.scenario.slug,
          analyst_handle: profile.handle,
          organization_name: "Northwind Polytechnic (Demo)",
          events,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    process.stdout.write(
      `  ${bundle.scenario.slug.padEnd(32)} ${String(events.length).padStart(3)} events -> ${path.relative(process.cwd(), file)}\n`,
    );
  }

  process.stdout.write(`\nWrote ${scenarios.length} sample session(s).\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
