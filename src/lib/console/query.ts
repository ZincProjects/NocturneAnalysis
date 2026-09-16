import type { LogEntry } from "@/lib/content/schema";
import { PHASE_KEYS, type PhaseKey } from "@/lib/events/types";

/**
 * The log viewer's query language.
 *
 * Deliberately a small imitation of Splunk/KQL rather than something novel:
 * `source:dns user:p.raman powershell`. A student who learns this bar has
 * learned the shape of the real thing - field, colon, value, plus free text -
 * which is the transferable part. Inventing a cleaner syntax would teach them
 * something they will never see again.
 *
 * Terms combine with AND. Free-text terms match the rendered message and the
 * extra fields. Unknown field names are treated as free text rather than
 * erroring, because a student typing `firewall:allow` should get results, not
 * a parser complaint.
 */

export const QUERY_FIELDS = [
  "source",
  "host",
  "user",
  "ip",
  "src_ip",
  "dst_ip",
  "domain",
  "action",
  "severity",
  "after",
  "before",
] as const;

export type QueryField = (typeof QUERY_FIELDS)[number];

export interface QueryTerm {
  field: QueryField | null;
  value: string;
  negated: boolean;
}

export interface ParsedQuery {
  terms: QueryTerm[];
  raw: string;
}

const TOKEN_RE = /"([^"]*)"|(\S+)/g;

export function parseQuery(raw: string): ParsedQuery {
  const terms: QueryTerm[] = [];

  for (const match of raw.matchAll(TOKEN_RE)) {
    const token = match[1] ?? match[2] ?? "";
    if (!token) continue;

    const negated = token.startsWith("-");
    const body = negated ? token.slice(1) : token;
    if (!body) continue;

    const colon = body.indexOf(":");
    if (colon > 0) {
      const field = body.slice(0, colon).toLowerCase();
      const value = body.slice(colon + 1);
      if ((QUERY_FIELDS as readonly string[]).includes(field) && value) {
        terms.push({ field: field as QueryField, value, negated });
        continue;
      }
    }

    terms.push({ field: null, value: body, negated });
  }

  return { terms, raw };
}

function contains(haystack: string | undefined | null, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Accepts `09:04`, `09:04:15` or a full ISO timestamp. Times without a date
 * are resolved against the entry's own date, so a student can scope to "after
 * 09:00" without knowing which fictional day the incident happened on.
 */
function timeBoundary(value: string, entryTs: string): number | null {
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const date = entryTs.slice(0, 10);
    const time = value.length === 5 ? `${value}:00` : value;
    return Date.parse(`${date}T${time}.000Z`);
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function matchesTerm(entry: LogEntry, term: QueryTerm): boolean {
  const { field, value } = term;

  switch (field) {
    case "source":
      return contains(entry.source, value);
    case "host":
      return contains(entry.host, value);
    case "user":
      return contains(entry.user, value);
    case "src_ip":
      return contains(entry.src_ip, value);
    case "dst_ip":
      return contains(entry.dst_ip, value);
    case "ip":
      // The useful default: an analyst pivoting on an address rarely cares
      // which end of the connection it was.
      return contains(entry.src_ip, value) || contains(entry.dst_ip, value);
    case "domain":
      return contains(entry.domain, value);
    case "action":
      return contains(entry.action, value);
    case "severity":
      return entry.severity?.toLowerCase() === value.toLowerCase();
    case "after": {
      const boundary = timeBoundary(value, entry.ts);
      return boundary === null ? true : Date.parse(entry.ts) >= boundary;
    }
    case "before": {
      const boundary = timeBoundary(value, entry.ts);
      return boundary === null ? true : Date.parse(entry.ts) <= boundary;
    }
    default: {
      if (contains(entry.message, value)) return true;
      if (contains(entry.host, value) || contains(entry.user, value)) return true;
      if (contains(entry.domain, value)) return true;
      if (contains(entry.src_ip, value) || contains(entry.dst_ip, value)) return true;
      return Object.values(entry.fields).some((v) => contains(String(v), value));
    }
  }
}

/** Log lines visible at a given phase. Later phases see everything earlier ones did. */
export function visibleAtPhase(entry: { reveal_phase: PhaseKey }, phase: PhaseKey): boolean {
  return PHASE_KEYS.indexOf(entry.reveal_phase) <= PHASE_KEYS.indexOf(phase);
}

export function runQuery(entries: LogEntry[], raw: string, phase: PhaseKey): LogEntry[] {
  const { terms } = parseQuery(raw);
  const available = entries.filter((e) => visibleAtPhase(e, phase));

  if (terms.length === 0) return available;

  return available.filter((entry) =>
    terms.every((term) => {
      const hit = matchesTerm(entry, term);
      return term.negated ? !hit : hit;
    }),
  );
}

/**
 * Field/value suggestions for the query bar's typeahead, drawn from the data
 * actually present rather than a fixed list - so a scenario with no proxy logs
 * does not offer `source:proxy` and return nothing.
 */
export interface Suggestion {
  value: string;
  label: string;
  hint?: string;
}

export function suggestions(entries: LogEntry[], phase: PhaseKey, input: string): Suggestion[] {
  const available = entries.filter((e) => visibleAtPhase(e, phase));
  const tokens = input.split(/\s+/);
  const current = tokens.at(-1) ?? "";
  const prefix = tokens.slice(0, -1).join(" ");
  const withPrefix = (term: string) => (prefix ? `${prefix} ${term} ` : `${term} `);

  const colon = current.indexOf(":");

  if (colon > 0) {
    const field = current.slice(0, colon).toLowerCase();
    const partial = current.slice(colon + 1).toLowerCase();

    const pool = new Set<string>();
    for (const entry of available) {
      const value =
        field === "source"
          ? entry.source
          : field === "host"
            ? entry.host
            : field === "user"
              ? entry.user
              : field === "domain"
                ? entry.domain
                : field === "action"
                  ? entry.action
                  : field === "severity"
                    ? entry.severity
                    : field === "ip" || field === "src_ip" || field === "dst_ip"
                      ? undefined
                      : undefined;
      if (value) pool.add(value);
      if (field === "ip" || field === "src_ip" || field === "dst_ip") {
        if (entry.src_ip) pool.add(entry.src_ip);
        if (entry.dst_ip) pool.add(entry.dst_ip);
      }
    }

    return [...pool]
      .filter((v) => v.toLowerCase().startsWith(partial))
      .sort()
      .slice(0, 8)
      .map((v) => ({ value: withPrefix(`${field}:${v}`), label: `${field}:${v}` }));
  }

  const FIELD_HINTS: Record<string, string> = {
    source: "Which system produced the line",
    host: "Endpoint or server name",
    user: "Account involved",
    ip: "Either end of the connection",
    domain: "Hostname queried or requested",
    action: "What the system did",
    severity: "critical, high, medium, low, info",
    after: "Time boundary, e.g. after:09:00",
    before: "Time boundary, e.g. before:09:30",
  };

  return QUERY_FIELDS.filter((f) => f in FIELD_HINTS)
    .filter((f) => f.startsWith(current.toLowerCase()))
    .slice(0, 8)
    .map((f) => ({
      value: withPrefix(`${f}:`).trimEnd(),
      label: `${f}:`,
      hint: FIELD_HINTS[f],
    }));
}
