/**
 * Copies dependency-free modules that both the Next.js app and the Deno Edge
 * Functions need into `supabase/functions/_shared/`.
 *
 *   npm run edge:sync
 *
 * Deno functions are deployed as a self-contained bundle and cannot import
 * from `src/`, so the code has to exist in both places. Rather than let the
 * two drift - which for the hash chain would mean the Edge Function writing
 * digests the app cannot verify, i.e. every session silently failing its own
 * integrity check - the copy is generated, and `tests/edge-shared.test.ts`
 * fails if it does not match the source byte for byte.
 */

import fs from "node:fs";
import path from "node:path";

export const SHARED_MODULES = [
  { from: path.join("src", "lib", "events", "hash.ts"), to: "hash.ts" },
] as const;

const TARGET_DIR = path.join("supabase", "functions", "_shared");

const BANNER = `// GENERATED FILE - do not edit.
//
// Copied verbatim from %SOURCE% by \`npm run edge:sync\`.
// Edit the source and re-run; a unit test fails if these drift apart.

`;

export function renderShared(sourcePath: string): string {
  const body = fs.readFileSync(sourcePath, "utf8");
  return BANNER.replace("%SOURCE%", sourcePath.split(path.sep).join("/")) + body;
}

export function sharedTargetPath(to: string): string {
  return path.join(TARGET_DIR, to);
}

function main() {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  for (const mod of SHARED_MODULES) {
    const target = sharedTargetPath(mod.to);
    fs.writeFileSync(target, renderShared(mod.from), "utf8");
    process.stdout.write(`  ${mod.from} -> ${target}\n`);
  }
}

if (process.argv[1]?.endsWith("sync-edge-shared.ts")) main();
