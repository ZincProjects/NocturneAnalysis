/**
 * Tamper-evident event hashing.
 *
 * This module is deliberately dependency-free and uses only Web Crypto, so the
 * exact same source runs in Node (tests, seed scripts), the browser (client
 * side verification) and Deno (the `append-event` Edge Function). A byte
 * identical copy lives at `supabase/functions/_shared/hash.ts`; the copy is
 * produced by `scripts/sync-edge-shared.ts` and a unit test fails if the two
 * ever drift.
 *
 * Chain definition:
 *
 *   hash_n = sha256( prev_hash + RS + canonicalJson(payload) + RS +
 *                    created_at + RS + event_type )
 *
 * where RS is U+001F (ASCII record separator) and prev_hash is the empty
 * string for the genesis event. The separators are not cosmetic: without them
 * a payload could be crafted whose trailing characters imitate the start of
 * the timestamp field, letting two different events collide on one digest.
 */

const RS = "";

export const GENESIS_PREV_HASH = "";

export interface HashInput {
  prevHash: string | null;
  eventType: string;
  payload: unknown;
  createdAt: string;
}

/**
 * Deterministic JSON: object keys sorted by code unit, no insignificant
 * whitespace, `undefined` members dropped. Two structurally equal payloads
 * must always produce the same string or the chain is worthless.
 */
export function canonicalJson(value: unknown): string {
  return stringify(value);
}

function stringify(value: unknown): string {
  if (value === null) return "null";

  const t = typeof value;

  if (t === "number") {
    if (!Number.isFinite(value as number)) {
      throw new TypeError("canonicalJson: non-finite number is not representable");
    }
    // JSON.stringify already emits the shortest round-tripping form.
    return JSON.stringify(value);
  }

  if (t === "boolean" || t === "string") return JSON.stringify(value);

  if (t === "bigint") {
    throw new TypeError("canonicalJson: bigint is not representable");
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stringify(item === undefined ? null : item)).join(",")}]`;
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined && typeof obj[k] !== "function")
      .sort();
    const body = keys.map((k) => `${JSON.stringify(k)}:${stringify(obj[k])}`).join(",");
    return `{${body}}`;
  }

  // undefined / function / symbol at the top level.
  throw new TypeError(`canonicalJson: unsupported value of type ${t}`);
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

/** The exact preimage that gets hashed. Exported so tests can assert on it. */
export function chainPreimage(input: HashInput): string {
  return [
    input.prevHash ?? GENESIS_PREV_HASH,
    canonicalJson(input.payload ?? {}),
    input.createdAt,
    input.eventType,
  ].join(RS);
}

export async function computeEventHash(input: HashInput): Promise<string> {
  return sha256Hex(chainPreimage(input));
}

export interface ChainLink {
  event_type: string;
  payload: unknown;
  created_at: string;
  prev_hash: string | null;
  hash: string;
}

export interface ChainVerification {
  valid: boolean;
  length: number;
  /** Index of the first event that failed, or null when the chain is intact. */
  brokenAtIndex: number | null;
  reason: string | null;
  /** Hash of the last event, usable as a short "seal" for a session. */
  headHash: string | null;
}

/**
 * Recomputes every link in order. Used by the instructor's "verify integrity"
 * button and by the generated report's integrity footer.
 */
export async function verifyChain(events: ChainLink[]): Promise<ChainVerification> {
  let expectedPrev: string = GENESIS_PREV_HASH;

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const actualPrev = event.prev_hash ?? GENESIS_PREV_HASH;

    if (actualPrev !== expectedPrev) {
      return {
        valid: false,
        length: events.length,
        brokenAtIndex: i,
        reason:
          i === 0
            ? "First event does not start from the genesis hash."
            : "Event does not reference the previous event's hash - a row was inserted, removed or reordered.",
        headHash: null,
      };
    }

    const recomputed = await computeEventHash({
      prevHash: actualPrev,
      eventType: event.event_type,
      payload: event.payload,
      createdAt: event.created_at,
    });

    if (recomputed !== event.hash) {
      return {
        valid: false,
        length: events.length,
        brokenAtIndex: i,
        reason:
          "Stored hash does not match the event's contents - the row was altered after it was written.",
        headHash: null,
      };
    }

    expectedPrev = event.hash;
  }

  return {
    valid: true,
    length: events.length,
    brokenAtIndex: null,
    reason: null,
    headHash: events.length > 0 ? events[events.length - 1].hash : null,
  };
}

/** Short human-readable form of a hash, for chips and report footers. */
export function shortHash(hash: string | null | undefined): string {
  if (!hash) return "-";
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`;
}
