/**
 * One-time (well, whenever ATT&CK publishes a new version) converter from the
 * official MITRE STIX bundle to the curated subset this app ships.
 *
 *   npm run mitre:build
 *
 * The output at `content/mitre/techniques.json` is committed to the repo and
 * read from disk at runtime. Nothing in the running app ever calls MITRE:
 * a classroom demo on a school's throttled wifi behaves exactly like local
 * development, and a live pitch cannot be derailed by a rate limit.
 *
 * ATT&CK content is (c) The MITRE Corporation and used under the ATT&CK Terms
 * of Use; see NOTICE.
 */

import fs from "node:fs";
import path from "node:path";

const STIX_URL =
  "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json";

const OUT_FILE = path.join(process.cwd(), "content", "mitre", "techniques.json");
const TACTICS_FILE = path.join(process.cwd(), "content", "mitre", "tactics.json");
const VERSION_FILE = path.join(process.cwd(), "content", "mitre", "version.json");

/**
 * The techniques the platform teaches. The first group is everything the four
 * launch scenarios map to; the rest are near neighbours included so the
 * heatmap and the technique picker show a realistic field of options rather
 * than only the right answers.
 */
const CURATED: string[] = [
  // Scenario A - phishing to endpoint compromise
  "T1566.001", "T1204.002", "T1059.001", "T1547.001", "T1071.001",
  // Scenario B - brute force and lateral movement
  "T1110", "T1078", "T1021.002", "T1560", "T1041",
  // Scenario C - web application attack
  "T1190",
  // Scenario D - ransomware
  "T1486", "T1490", "T1489",

  // Initial access neighbours
  "T1566", "T1566.002", "T1598", "T1189", "T1133", "T1195.002",
  // Execution
  "T1059", "T1059.003", "T1059.005", "T1203", "T1204", "T1204.001", "T1569.002",
  // Persistence
  "T1053.005", "T1543.003", "T1136.001", "T1098", "T1505.003",
  // Privilege escalation
  "T1068", "T1134", "T1548.002",
  // Defense evasion
  "T1070.004", "T1027", "T1140", "T1685", "T1112", "T1218.011",
  // Credential access
  "T1003.001", "T1110.001", "T1110.003", "T1555", "T1552.001", "T1558.003",
  // Discovery
  "T1087.002", "T1018", "T1082", "T1083", "T1057", "T1046", "T1016",
  // Lateral movement
  "T1021.001", "T1021.006", "T1570", "T1550.002",
  // Collection
  "T1005", "T1074.001", "T1560.001", "T1114.001", "T1119",
  // Command and control
  "T1105", "T1573.002", "T1090", "T1568.002",
  // Exfiltration
  "T1567.002", "T1048.003",
  // Impact
  "T1485", "T1491.001",
];

interface StixObject {
  type: string;
  id: string;
  name?: string;
  description?: string;
  revoked?: boolean;
  x_mitre_deprecated?: boolean;
  x_mitre_is_subtechnique?: boolean;
  kill_chain_phases?: { kill_chain_name: string; phase_name: string }[];
  external_references?: { source_name: string; external_id?: string; url?: string }[];
}

/**
 * Tactic names and their left-to-right order are read out of the bundle's
 * matrix object rather than hardcoded. ATT&CK reshapes the matrix between
 * versions - v19 renamed Defense Evasion to Stealth and split out a new
 * Defense Impairment tactic - and a hardcoded list would silently produce
 * heatmap columns labelled with raw STIX slugs.
 */
interface TacticInfo {
  shortname: string;
  name: string;
  tactic_id: string;
}

function readTactics(objects: StixObject[]): TacticInfo[] {
  const raw = objects as unknown as {
    type: string;
    id: string;
    name?: string;
    x_mitre_shortname?: string;
    tactic_refs?: string[];
    external_references?: { source_name: string; external_id?: string }[];
  }[];

  const matrix = raw.find((o) => o.type === "x-mitre-matrix");
  const byId = new Map(raw.filter((o) => o.type === "x-mitre-tactic").map((o) => [o.id, o]));

  const refs = matrix?.tactic_refs ?? [...byId.keys()];

  return refs.flatMap((ref) => {
    const tactic = byId.get(ref);
    if (!tactic?.x_mitre_shortname || !tactic.name) return [];
    const ext = tactic.external_references?.find((r) => r.source_name === "mitre-attack");
    return [
      {
        shortname: tactic.x_mitre_shortname,
        name: tactic.name,
        tactic_id: ext?.external_id ?? tactic.x_mitre_shortname,
      },
    ];
  });
}

/** Strips the `(Citation: ...)` markers ATT&CK embeds in descriptions. */
function cleanDescription(raw: string): string {
  const firstParagraph = raw.split("\n\n")[0] ?? raw;
  return firstParagraph
    .replace(/\(Citation:[^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<\/?code>/g, "`")
    .replace(/\s+/g, " ")
    .trim();
}

/** Follows ATT&CK `revoked-by` relationships to find what replaced an ID. */
function resolveReplacements(objects: StixObject[], missing: string[]): Map<string, string> {
  const externalId = (obj: StixObject) =>
    obj.external_references?.find((r) => r.source_name === "mitre-attack")?.external_id ?? null;

  const byStixId = new Map<string, StixObject>();
  for (const obj of objects) {
    if (obj.type === "attack-pattern") byStixId.set(obj.id, obj);
  }

  const wanted = new Set(missing);
  const out = new Map<string, string>();

  for (const obj of objects) {
    const rel = obj as unknown as {
      type: string;
      relationship_type?: string;
      source_ref?: string;
      target_ref?: string;
    };
    if (rel.type !== "relationship" || rel.relationship_type !== "revoked-by") continue;

    const source = rel.source_ref ? byStixId.get(rel.source_ref) : undefined;
    const target = rel.target_ref ? byStixId.get(rel.target_ref) : undefined;
    if (!source || !target) continue;

    const from = externalId(source);
    const to = externalId(target);
    if (from && to && wanted.has(from)) out.set(from, `${to} (${target.name ?? "unnamed"})`);
  }

  return out;
}

async function main() {
  process.stdout.write(`Fetching ATT&CK Enterprise STIX bundle...\n`);
  const res = await fetch(STIX_URL);
  if (!res.ok) throw new Error(`Failed to fetch STIX bundle: ${res.status} ${res.statusText}`);

  const bundle = (await res.json()) as { objects: StixObject[] };
  process.stdout.write(`  ${bundle.objects.length} STIX objects\n`);

  const tacticList = readTactics(bundle.objects);
  const tacticNames = new Map(tacticList.map((t) => [t.shortname, t.name]));
  process.stdout.write(`  ${tacticList.length} tactics in the matrix\n`);

  const wanted = new Set(CURATED);
  const byId = new Map<string, ReturnType<typeof toTechnique>>();

  function toTechnique(obj: StixObject, techniqueId: string) {
    const ref = obj.external_references?.find((r) => r.source_name === "mitre-attack");
    const phases = (obj.kill_chain_phases ?? []).filter(
      (p) => p.kill_chain_name === "mitre-attack",
    );
    const tactics = phases.map((p) => tacticNames.get(p.phase_name) ?? p.phase_name);
    const tacticIds = phases.map((p) => p.phase_name);

    const unknown = phases.filter((p) => !tacticNames.has(p.phase_name));
    if (unknown.length > 0) {
      throw new Error(
        `${techniqueId} references tactic(s) not present in the matrix: ${unknown
          .map((p) => p.phase_name)
          .join(", ")}`,
      );
    }

    return {
      technique_id: techniqueId,
      name: obj.name ?? techniqueId,
      tactic: tactics[0] ?? "Unknown",
      tactic_id: tacticIds[0] ?? "unknown",
      tactics,
      tactic_ids: tacticIds,
      url: ref?.url ?? `https://attack.mitre.org/techniques/${techniqueId.replace(".", "/")}/`,
      description: cleanDescription(obj.description ?? ""),
      is_subtechnique: Boolean(obj.x_mitre_is_subtechnique),
      parent_id: techniqueId.includes(".") ? techniqueId.split(".")[0] : null,
    };
  }

  for (const obj of bundle.objects) {
    if (obj.type !== "attack-pattern") continue;
    if (obj.revoked || obj.x_mitre_deprecated) continue;

    const ref = obj.external_references?.find((r) => r.source_name === "mitre-attack");
    const techniqueId = ref?.external_id;
    if (!techniqueId || !wanted.has(techniqueId)) continue;

    byId.set(techniqueId, toTechnique(obj, techniqueId));
  }

  const missing = CURATED.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    // ATT&CK revokes and renumbers techniques between versions (v19 promoted
    // several Impair Defenses sub-techniques to top-level IDs, for example).
    // Resolving the replacement here turns a yearly mystery failure into a
    // one-line edit.
    const replacements = resolveReplacements(bundle.objects, missing);
    const detail = missing
      .map((id) => `${id}${replacements.get(id) ? ` -> now ${replacements.get(id)}` : " (no replacement found)"}`)
      .join("\n    ");
    throw new Error(
      `These curated technique IDs are not in the current bundle:\n    ${detail}\n` +
        `Update the CURATED list (and any scenario that maps to them) and re-run.`,
    );
  }

  const techniques = [...byId.values()].sort((a, b) => a.technique_id.localeCompare(b.technique_id));

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(techniques, null, 2)}\n`, "utf8");
  fs.writeFileSync(TACTICS_FILE, `${JSON.stringify(tacticList, null, 2)}\n`, "utf8");

  const version =
    (bundle.objects as unknown as { type: string; x_mitre_version?: string }[]).find(
      (o) => o.type === "x-mitre-collection",
    )?.x_mitre_version ?? "unknown";
  fs.writeFileSync(
    VERSION_FILE,
    `${JSON.stringify({ attack_version: version, generated_at: new Date().toISOString(), technique_count: techniques.length }, null, 2)}\n`,
    "utf8",
  );

  const tacticCount = new Set(techniques.flatMap((t) => t.tactics)).size;
  process.stdout.write(
    `Wrote ${techniques.length} techniques across ${tacticCount} tactics ` +
      `(ATT&CK v${version}) to ${path.relative(process.cwd(), OUT_FILE)}\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
