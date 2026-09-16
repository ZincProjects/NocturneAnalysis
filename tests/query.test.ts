import { describe, expect, it } from "vitest";

import { parseQuery, runQuery, suggestions, visibleAtPhase } from "@/lib/console/query";
import type { LogEntry } from "@/lib/content/schema";

function entry(overrides: Partial<LogEntry> & { id: string }): LogEntry {
  return {
    ts: "2025-03-11T09:00:00.000Z",
    source: "dns",
    message: "query=example.example",
    fields: {},
    is_decoy: false,
    reveal_phase: "triage",
    ...overrides,
  } as LogEntry;
}

const LOGS: LogEntry[] = [
  entry({
    id: "1",
    source: "dns",
    host: "WKS-HR-014",
    user: "p.raman",
    domain: "update-cdn.paylo4d.example",
    src_ip: "10.20.4.87",
    dst_ip: "203.0.113.47",
    severity: "high",
    action: "resolved",
    message: "query=update-cdn.paylo4d.example response=203.0.113.47",
    ts: "2025-03-11T09:03:14.000Z",
    reveal_phase: "investigation",
  }),
  entry({
    id: "2",
    source: "proxy",
    host: "WKS-HR-014",
    user: "p.raman",
    domain: "update-cdn.paylo4d.example",
    dst_ip: "203.0.113.47",
    severity: "critical",
    action: "allowed",
    message: "GET https://update-cdn.paylo4d.example/s2 user-agent=WindowsPowerShell/5.1",
    ts: "2025-03-11T09:03:15.000Z",
    reveal_phase: "investigation",
  }),
  entry({
    id: "3",
    source: "edr",
    host: "WKS-HR-015",
    user: "a.wong",
    severity: "low",
    action: "quarantined",
    message: "DETECTION FreePDFToolbar.exe verdict=pup",
    ts: "2025-03-11T08:47:30.000Z",
    is_decoy: true,
    reveal_phase: "triage",
  }),
  entry({
    id: "4",
    source: "auth",
    host: "WKS-HR-014",
    user: "p.raman",
    action: "logon_success",
    message: "EventID=4624 Logon Type=2",
    ts: "2025-03-11T08:12:04.000Z",
    fields: { event_id: 4624, logon_type: 2 },
    reveal_phase: "triage",
  }),
];

describe("parseQuery", () => {
  it("splits field terms from free text", () => {
    const { terms } = parseQuery("source:dns powershell");
    expect(terms).toEqual([
      { field: "source", value: "dns", negated: false },
      { field: null, value: "powershell", negated: false },
    ]);
  });

  it("supports negation", () => {
    const { terms } = parseQuery("-source:proxy");
    expect(terms[0]).toEqual({ field: "source", value: "proxy", negated: true });
  });

  it("keeps quoted phrases together", () => {
    const { terms } = parseQuery('"logon type 2"');
    expect(terms[0].value).toBe("logon type 2");
  });

  it("treats an unknown field as free text rather than erroring", () => {
    // A student typing `firewall:allow` should get results, not a complaint.
    const { terms } = parseQuery("firewall:allow");
    expect(terms[0]).toEqual({ field: null, value: "firewall:allow", negated: false });
  });

  it("returns no terms for an empty query", () => {
    expect(parseQuery("   ").terms).toEqual([]);
  });
});

describe("visibleAtPhase", () => {
  it("hides entries revealed by a later phase", () => {
    expect(visibleAtPhase({ reveal_phase: "investigation" }, "triage")).toBe(false);
  });

  it("shows earlier entries in later phases", () => {
    expect(visibleAtPhase({ reveal_phase: "triage" }, "containment")).toBe(true);
  });
});

describe("runQuery", () => {
  it("returns only what the current phase has revealed", () => {
    expect(runQuery(LOGS, "", "triage").map((l) => l.id)).toEqual(["3", "4"]);
    expect(runQuery(LOGS, "", "investigation")).toHaveLength(4);
  });

  it("filters by source", () => {
    expect(runQuery(LOGS, "source:dns", "investigation").map((l) => l.id)).toEqual(["1"]);
  });

  it("combines terms with AND", () => {
    expect(runQuery(LOGS, "host:WKS-HR-014 source:proxy", "investigation").map((l) => l.id)).toEqual([
      "2",
    ]);
  });

  it("matches ip against either end of the connection", () => {
    expect(runQuery(LOGS, "ip:203.0.113.47", "investigation").map((l) => l.id)).toEqual(["1", "2"]);
    expect(runQuery(LOGS, "ip:10.20.4.87", "investigation").map((l) => l.id)).toEqual(["1"]);
  });

  it("matches free text against the message", () => {
    expect(runQuery(LOGS, "powershell", "investigation").map((l) => l.id)).toEqual(["2"]);
  });

  it("matches free text against extra fields", () => {
    expect(runQuery(LOGS, "4624", "investigation").map((l) => l.id)).toEqual(["4"]);
  });

  it("is case-insensitive", () => {
    expect(runQuery(LOGS, "host:wks-hr-014", "investigation")).toHaveLength(3);
  });

  it("excludes with a negated term", () => {
    expect(runQuery(LOGS, "host:WKS-HR-014 -source:auth", "investigation").map((l) => l.id)).toEqual([
      "1",
      "2",
    ]);
  });

  it("matches severity exactly rather than by substring", () => {
    // "low" must not match "critical" simply because both contain letters.
    expect(runQuery(LOGS, "severity:low", "investigation").map((l) => l.id)).toEqual(["3"]);
    expect(runQuery(LOGS, "severity:critical", "investigation").map((l) => l.id)).toEqual(["2"]);
  });

  it("resolves a bare time against the entry's own date", () => {
    expect(runQuery(LOGS, "after:09:00", "investigation").map((l) => l.id)).toEqual(["1", "2"]);
    expect(runQuery(LOGS, "before:08:30", "investigation").map((l) => l.id)).toEqual(["4"]);
  });

  it("accepts a full ISO timestamp as a boundary", () => {
    expect(
      runQuery(LOGS, "after:2025-03-11T09:03:15.000Z", "investigation").map((l) => l.id),
    ).toEqual(["2"]);
  });

  it("ignores an unparseable time boundary rather than returning nothing", () => {
    expect(runQuery(LOGS, "after:notatime", "investigation")).toHaveLength(4);
  });

  it("includes decoys, because deciding they are noise is the exercise", () => {
    expect(runQuery(LOGS, "source:edr", "investigation").map((l) => l.id)).toEqual(["3"]);
  });

  it("returns nothing when terms conflict", () => {
    expect(runQuery(LOGS, "source:dns source:proxy", "investigation")).toHaveLength(0);
  });
});

describe("suggestions", () => {
  it("offers field names while typing one", () => {
    const hints = suggestions(LOGS, "investigation", "sou");
    expect(hints.map((h) => h.label)).toContain("source:");
  });

  it("offers values drawn from the data, not a fixed list", () => {
    const hints = suggestions(LOGS, "investigation", "source:");
    expect(hints.map((h) => h.label).sort()).toEqual([
      "source:auth",
      "source:dns",
      "source:edr",
      "source:proxy",
    ]);
  });

  it("does not offer values hidden at the current phase", () => {
    const hints = suggestions(LOGS, "triage", "source:");
    expect(hints.map((h) => h.label).sort()).toEqual(["source:auth", "source:edr"]);
  });

  it("offers both ends of a connection for ip", () => {
    const hints = suggestions(LOGS, "investigation", "ip:");
    expect(hints.map((h) => h.label)).toContain("ip:203.0.113.47");
    expect(hints.map((h) => h.label)).toContain("ip:10.20.4.87");
  });

  it("preserves earlier terms when completing the last one", () => {
    const hints = suggestions(LOGS, "investigation", "host:WKS-HR-014 source:d");
    expect(hints[0]?.value.startsWith("host:WKS-HR-014 ")).toBe(true);
  });
});
