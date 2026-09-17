import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildChallenges, buildDnsLog, buildXorFile, FILES, flagFor } from "../scripts/ctf-seed";
import { caesarShift, singleByteXorDecodeHex } from "@/lib/ctf/artifacts/ciphers";
import { decodePng, embedLsb, encodePng, extractLsb } from "@/lib/ctf/artifacts/png";
import { hashFlag, normalizeFlag } from "@/lib/ctf/flag";

const publicFile = (file: string) => fs.readFileSync(path.join(process.cwd(), "public", file));

describe("flag normalisation", () => {
  it("ignores case, surrounding whitespace and a missing wrapper", () => {
    const canonical = normalizeFlag("flag{et_tu_brute_force}");
    expect(normalizeFlag("  FLAG{Et_Tu_Brute_Force} ")).toBe(canonical);
    expect(normalizeFlag("et_tu_brute_force")).toBe(canonical);
    expect(normalizeFlag("flag{ et_tu_brute_force }")).toBe(canonical);
    expect(hashFlag("FLAG{T1059.001}")).toBe(hashFlag("t1059.001"));
  });

  it("does not forgive anything else", () => {
    expect(hashFlag("flag{et-tu-brute-force}")).not.toBe(hashFlag("flag{et_tu_brute_force}"));
    expect(hashFlag("flag{T1059}")).not.toBe(hashFlag("flag{T1059.001}"));
  });
});

/**
 * Solves every challenge the way a player would, from what the player is given.
 * If the committed files drift from the flags, this fails before a class does.
 */
describe("every challenge is solvable from its artifacts", () => {
  const challenges = buildChallenges();
  const bySlug = Object.fromEntries(challenges.map((c) => [c.slug, c]));

  it("ships eight challenges across all four categories", () => {
    expect(challenges).toHaveLength(8);
    expect(new Set(challenges.map((c) => c.category))).toEqual(new Set(["web", "crypto", "forensics", "misc"]));
    for (const c of challenges) {
      expect(c.prompt_md).not.toContain(flagFor(c.slug));
      for (const hint of c.hints) expect(hint.text).not.toContain(flagFor(c.slug));
    }
  });

  it("Caesar's Ghost: brute-forcing the shift recovers the flag", () => {
    const cipher = /```\n(.+)\n```/.exec(bySlug["caesars-ghost"].prompt_md)![1];
    const candidates = Array.from({ length: 26 }, (_, k) => caesarShift(cipher, -k));
    expect(candidates.map((c) => hashFlag(c))).toContain(hashFlag(flagFor("caesars-ghost")));
  });

  it("XOR Marks the Spot: the committed file decodes with a single-byte key", () => {
    const text = publicFile(FILES.xor).toString("utf8");
    expect(text).toBe(buildXorFile());
    const hex = text.split("\n").filter((line) => /^[0-9a-f]+$/.test(line)).join("");
    const found = Array.from({ length: 256 }, (_, k) => singleByteXorDecodeHex(hex, k)).find((p) => p.startsWith("flag{"));
    expect(found && hashFlag(found)).toBe(hashFlag(flagFor("xor-marks-the-spot")));
  });

  it("Metadata Never Forgets: the flag is readable text inside the JPEG", () => {
    const text = publicFile(FILES.jpeg).toString("latin1");
    const found = /flag\{[^}]+\}/.exec(text)?.[0];
    expect(found && hashFlag(found)).toBe(hashFlag(flagFor("metadata-never-forgets")));
  });

  it("Packet Whisper: one base64 DNS label decodes to the flag", () => {
    const entries = JSON.parse(publicFile(FILES.dns).toString("utf8")) as { domain: string }[];
    expect(entries).toEqual(buildDnsLog());
    const decoded = entries.map((e) => Buffer.from(e.domain.split(".")[0], "base64").toString("utf8"));
    const found = decoded.find((d) => d.startsWith("flag{"));
    expect(found && hashFlag(found)).toBe(hashFlag(flagFor("packet-whisper")));
    expect(entries.some((e) => "is_decoy" in e)).toBe(false);
  });

  it("Hidden in Plain Sight: the PNG's RGB least significant bits spell the flag", () => {
    const found = extractLsb(decodePng(publicFile(FILES.png)));
    expect(hashFlag(found)).toBe(hashFlag(flagFor("hidden-in-plain-sight")));
  });

  it("the PNG codec round-trips", () => {
    const image = { width: 4, height: 3, pixels: Uint8Array.from({ length: 36 }, (_, i) => i * 7) };
    const stego = embedLsb({ width: 40, height: 10, pixels: new Uint8Array(1200).fill(200) }, "hi");
    expect(decodePng(encodePng(image))).toEqual(image);
    expect(extractLsb(decodePng(encodePng(stego)))).toBe("hi");
  });
});
