import { createHash } from "node:crypto";

/**
 * The one flag normalisation rule, applied identically when the seed script
 * hashes a flag and when a player submits one:
 *
 *   1. Unicode NFKC, then trim surrounding whitespace.
 *   2. If the value is wrapped in `flag{...}` (any case), take what is inside;
 *      otherwise take the whole value. Players who forget the wrapper are not
 *      punished for it.
 *   3. Trim and lowercase the inside, and re-wrap it as `flag{...}`.
 *
 * So `  FLAG{Et_Tu_Brute_Force} `, `flag{et_tu_brute_force}` and
 * `et_tu_brute_force` are the same answer. Nothing else is forgiven: no
 * collapsing of inner whitespace, no swapping `-` for `_`.
 */
export function normalizeFlag(value: string): string {
  const trimmed = value.normalize("NFKC").trim();
  const wrapped = /^flag\{([\s\S]*)\}$/i.exec(trimmed);
  const inner = (wrapped ? wrapped[1] : trimmed).trim().toLowerCase();
  return `flag{${inner}}`;
}

/** sha256(normalizeFlag(value)) as lowercase hex - the form stored in `ctf_challenges.flag_hash`. */
export function hashFlag(value: string): string {
  return createHash("sha256").update(normalizeFlag(value), "utf8").digest("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Mirrors the database check on `ctf_players.handle`. */
export const HANDLE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{2,23}$/;
