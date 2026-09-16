/**
 * Mechanical enforcement of the synthetic-data guarantee.
 *
 * The product's core claim to a school's IT department is that nothing in it
 * points at real infrastructure. That claim is worth only as much as the check
 * behind it, so every scenario's text is swept for IP addresses and hostnames
 * and each one must fall inside a range reserved by the IETF for
 * documentation. `npm run content:validate` runs this in CI and fails the
 * build on a violation.
 */

/** RFC 5737 documentation ranges. */
const DOC_IPV4_PREFIXES = ["192.0.2.", "198.51.100.", "203.0.113."];

/** RFC 3849 documentation range. */
const DOC_IPV6_PREFIX = "2001:db8:";

/** RFC 2606 / RFC 6761 reserved TLDs, plus RFC 8375 home.arpa. */
const RESERVED_TLDS = ["example", "test", "invalid", "localhost", "local", "arpa"];

/** RFC 1918 + loopback + link-local. Private space is fine: it cannot route. */
const PRIVATE_IPV4_PATTERNS = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\.0\.0\.0$/,
  /^255\.255\.255\.255$/,
];

const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;

export interface SafetyViolation {
  kind: "ip" | "domain";
  value: string;
  reason: string;
  /** Where it was found, e.g. "phishing-initial-access/assets/logs.json". */
  location: string;
}

function isDocumentationIp(ip: string): boolean {
  if (DOC_IPV4_PREFIXES.some((p) => ip.startsWith(p))) return true;
  if (PRIVATE_IPV4_PATTERNS.some((p) => p.test(ip))) return true;
  return false;
}

function isValidIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    const n = Number(p);
    return Number.isInteger(n) && n >= 0 && n <= 255 && String(n) === p.replace(/^0+(?=\d)/, "");
  });
}

function hasReservedTld(host: string): boolean {
  const lower = host.toLowerCase().replace(/\.$/, "");
  if (lower.startsWith(DOC_IPV6_PREFIX)) return true;
  const tld = lower.split(".").pop() ?? "";
  return RESERVED_TLDS.includes(tld);
}

/**
 * Hosts that legitimately appear in prose and are not scenario infrastructure
 * (framework references, the product's own docs links). Kept explicit and
 * short so it cannot quietly become a hole in the check.
 */
const PROSE_ALLOWLIST = new Set([
  "attack.mitre.org",
  "owasp.org",
  "cheatsheetseries.owasp.org",
  "csrc.nist.gov",
  "nvlpubs.nist.gov",
  "www.cisa.gov",
  "nocturneanalysis.app",
]);

export function scanForUnsafeReferences(text: string, location: string): SafetyViolation[] {
  const violations: SafetyViolation[] = [];

  for (const match of text.matchAll(IPV4_RE)) {
    const ip = match[0];
    // Version strings and dotted decimals that are not addresses.
    if (!isValidIpv4(ip)) continue;
    if (isDocumentationIp(ip)) continue;
    violations.push({
      kind: "ip",
      value: ip,
      location,
      reason:
        "Not in an RFC 5737 documentation range (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) or RFC 1918 private space.",
    });
  }

  for (const match of text.matchAll(HOSTNAME_RE)) {
    const host = match[0];
    if (isValidIpv4(host)) continue;
    if (PROSE_ALLOWLIST.has(host.toLowerCase())) continue;
    if (hasReservedTld(host)) continue;
    violations.push({
      kind: "domain",
      value: host,
      location,
      reason:
        "Does not use an RFC 2606 reserved TLD (.example, .test, .invalid, .localhost). Scenario domains must be unresolvable.",
    });
  }

  // Deduplicate: one report per distinct value per location is enough.
  const seen = new Set<string>();
  return violations.filter((v) => {
    const key = `${v.kind}:${v.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function scanObjectForUnsafeReferences(value: unknown, location: string): SafetyViolation[] {
  return scanForUnsafeReferences(JSON.stringify(value), location);
}
