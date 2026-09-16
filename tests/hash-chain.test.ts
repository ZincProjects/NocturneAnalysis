import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  chainPreimage,
  computeEventHash,
  sha256Hex,
  shortHash,
  verifyChain,
  type ChainLink,
} from "@/lib/events/hash";

/**
 * The hash chain is the claim this platform makes to schools about assessment
 * integrity, so these tests are written to try to break it rather than to
 * demonstrate that it works on a happy path.
 */

async function buildChain(
  events: { event_type: string; payload: unknown; created_at: string }[],
): Promise<ChainLink[]> {
  const chain: ChainLink[] = [];
  let prev = "";

  for (const event of events) {
    const hash = await computeEventHash({
      prevHash: prev,
      eventType: event.event_type,
      payload: event.payload,
      createdAt: event.created_at,
    });
    chain.push({ ...event, prev_hash: prev, hash });
    prev = hash;
  }

  return chain;
}

const SAMPLE = [
  { event_type: "SESSION_START", payload: { scenario_slug: "a" }, created_at: "2025-01-01T09:00:00.000Z" },
  { event_type: "VIEW_ALERT", payload: { alert_id: "alert-1" }, created_at: "2025-01-01T09:00:10.000Z" },
  { event_type: "TAG_IOC", payload: { value: "203.0.113.47" }, created_at: "2025-01-01T09:01:00.000Z" },
  { event_type: "SUBMIT_DECISION", payload: { decision_key: "severity", decision_value: "high" }, created_at: "2025-01-01T09:02:00.000Z" },
];

describe("canonicalJson", () => {
  it("is stable regardless of key insertion order", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it("sorts keys at every level, not just the top", () => {
    expect(canonicalJson({ z: { d: 1, c: 2 }, a: 3 })).toBe('{"a":3,"z":{"c":2,"d":1}}');
  });

  it("preserves array order, which is significant", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
    expect(canonicalJson([1, 2, 3])).not.toBe(canonicalJson([3, 2, 1]));
  });

  it("drops undefined members rather than emitting them", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it("normalises undefined inside arrays to null, as JSON does", () => {
    expect(canonicalJson([1, undefined, 3])).toBe("[1,null,3]");
  });

  it("refuses values it cannot represent deterministically", () => {
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(TypeError);
    expect(() => canonicalJson({ n: Number.POSITIVE_INFINITY })).toThrow(TypeError);
    expect(() => canonicalJson({ n: BigInt(1) })).toThrow(TypeError);
  });

  it("escapes characters that would otherwise change the preimage", () => {
    expect(canonicalJson({ a: 'x"y' })).toBe('{"a":"x\\"y"}');
  });
});

describe("chainPreimage", () => {
  it("separates fields so one cannot borrow characters from the next", () => {
    // These two events are different, but their fields concatenate to exactly
    // the same string. Without a delimiter between fields they would share a
    // preimage and therefore a digest, and one event could be swapped for
    // another that hashes identically.
    const a = chainPreimage({
      prevHash: "",
      eventType: "ADD_NOTE",
      payload: {},
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    const b = chainPreimage({
      prevHash: "",
      eventType: "_NOTE",
      payload: {},
      createdAt: "2025-01-01T00:00:00.000ZADD",
    });

    // The naive concatenation really would collide - that is the point.
    expect("{}" + "2025-01-01T00:00:00.000Z" + "ADD_NOTE").toBe(
      "{}" + "2025-01-01T00:00:00.000ZADD" + "_NOTE",
    );

    // The delimited preimage does not.
    expect(a).not.toBe(b);
  });

  it("keeps a payload containing the delimiter from forging another preimage", () => {
    const a = chainPreimage({
      prevHash: "",
      eventType: "ADD_NOTE",
      payload: { text: "x" },
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    const b = chainPreimage({
      prevHash: "",
      eventType: "ADD_NOTE",
      payload: { text: "x\u001f2025-01-01T00:00:00.000Z" },
      createdAt: "",
    });

    // JSON escaping keeps the delimiter inside the quoted string rather than
    // terminating the field, so the payload cannot impersonate the timestamp.
    expect(a).not.toBe(b);
  });

  it("treats a null previous hash as the genesis empty string", () => {
    const withNull = chainPreimage({
      prevHash: null,
      eventType: "SESSION_START",
      payload: {},
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    const withEmpty = chainPreimage({
      prevHash: "",
      eventType: "SESSION_START",
      payload: {},
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    expect(withNull).toBe(withEmpty);
  });
});

describe("sha256Hex", () => {
  it("matches the published digest of the empty string", async () => {
    expect(await sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("matches the published digest of 'abc'", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("verifyChain", () => {
  it("accepts an intact chain and reports its head", async () => {
    const chain = await buildChain(SAMPLE);
    const result = await verifyChain(chain);

    expect(result.valid).toBe(true);
    expect(result.length).toBe(4);
    expect(result.brokenAtIndex).toBeNull();
    expect(result.headHash).toBe(chain[3].hash);
  });

  it("accepts an empty chain", async () => {
    const result = await verifyChain([]);
    expect(result.valid).toBe(true);
    expect(result.headHash).toBeNull();
  });

  it("detects an edited payload", async () => {
    const chain = await buildChain(SAMPLE);
    chain[2] = { ...chain[2], payload: { value: "192.0.2.1" } };

    const result = await verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(2);
    expect(result.reason).toContain("does not match");
  });

  it("detects a backdated timestamp", async () => {
    const chain = await buildChain(SAMPLE);
    chain[1] = { ...chain[1], created_at: "2025-01-01T08:00:00.000Z" };

    const result = await verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
  });

  it("detects a changed event type", async () => {
    const chain = await buildChain(SAMPLE);
    chain[3] = { ...chain[3], event_type: "ADD_NOTE" };

    const result = await verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(3);
  });

  it("detects a deleted event", async () => {
    const chain = await buildChain(SAMPLE);
    const result = await verifyChain([chain[0], chain[2], chain[3]]);

    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
    expect(result.reason).toContain("previous event");
  });

  it("detects reordered events", async () => {
    const chain = await buildChain(SAMPLE);
    const result = await verifyChain([chain[0], chain[2], chain[1], chain[3]]);

    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(1);
  });

  it("detects an event spliced into the middle", async () => {
    const chain = await buildChain(SAMPLE);
    const forged: ChainLink = {
      event_type: "GRADE_ASSIGNED",
      payload: { score: 999 },
      created_at: "2025-01-01T09:01:30.000Z",
      prev_hash: chain[2].hash,
      hash: await computeEventHash({
        prevHash: chain[2].hash,
        eventType: "GRADE_ASSIGNED",
        payload: { score: 999 },
        createdAt: "2025-01-01T09:01:30.000Z",
      }),
    };

    // The forged event hashes correctly in isolation - an attacker with the
    // algorithm can always do that. What it cannot do is leave the event that
    // followed it still pointing at the right predecessor.
    const result = await verifyChain([chain[0], chain[1], chain[2], forged, chain[3]]);

    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(4);
  });

  it("detects a chain that does not begin at genesis", async () => {
    const chain = await buildChain(SAMPLE);
    const result = await verifyChain(chain.slice(1));

    expect(result.valid).toBe(false);
    expect(result.brokenAtIndex).toBe(0);
    expect(result.reason).toContain("genesis");
  });

  it("is insensitive to payload key order, so re-serialisation does not break it", async () => {
    const chain = await buildChain([
      { event_type: "SUBMIT_DECISION", payload: { a: 1, b: 2 }, created_at: "2025-01-01T09:00:00.000Z" },
    ]);
    chain[0] = { ...chain[0], payload: { b: 2, a: 1 } };

    expect((await verifyChain(chain)).valid).toBe(true);
  });
});

describe("shortHash", () => {
  it("abbreviates a digest for display", () => {
    expect(shortHash("a".repeat(60) + "bcde")).toBe("aaaaaaaa...bcde");
  });

  it("renders a dash for a missing hash", () => {
    expect(shortHash(null)).toBe("-");
    expect(shortHash(undefined)).toBe("-");
  });
});
