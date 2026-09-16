"use client";

import * as React from "react";
import { ChevronRight, Search, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SeverityChip, type Severity } from "@/components/shared/chips";
import { cn, formatUtc } from "@/lib/utils";
import { runQuery, suggestions, type Suggestion } from "@/lib/console/query";
import type { LogEntry } from "@/lib/content/schema";
import type { PhaseKey } from "@/lib/events/types";

const EXAMPLES = ["source:dns", "host:WKS-HR-014", "source:proxy powershell", "severity:high"];

/**
 * The log/query viewer.
 *
 * A simplified SIEM search over the scenario's own log set. It is not backed
 * by real SIEM infrastructure and does not pretend to be - but the pivot loop
 * it teaches (search, read, notice something, search on that) is the same loop
 * an analyst runs in front of Splunk or Elastic.
 *
 * Running a query is itself an event: phases can require that the student
 * actually searched, and the instructor sees which queries they tried.
 */
export function LogViewer({
  logs,
  phase,
  taggedValues,
  onRunQuery,
  onViewEntry,
  onTagValue,
  focusValue,
}: {
  logs: LogEntry[];
  phase: PhaseKey;
  taggedValues: string[];
  onRunQuery: (query: string, resultCount: number) => void;
  onViewEntry: (entry: LogEntry) => void;
  onTagValue: (value: string, entry: LogEntry) => void;
  focusValue?: string | null;
}) {
  const [input, setInput] = React.useState("");
  const [submitted, setSubmitted] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const results = React.useMemo(() => runQuery(logs, submitted, phase), [logs, submitted, phase]);
  const hints: Suggestion[] = React.useMemo(
    () => (showSuggestions ? suggestions(logs, phase, input) : []),
    [showSuggestions, logs, phase, input],
  );
  const tagged = React.useMemo(() => new Set(taggedValues), [taggedValues]);

  // Clicking a value on the IOC board or in an alert drops it into the bar, so
  // pivoting never means retyping an indicator by hand.
  React.useEffect(() => {
    if (!focusValue) return;
    setInput(focusValue);
    setSubmitted(focusValue);
    onRunQuery(focusValue, runQuery(logs, focusValue, phase).length);
    inputRef.current?.focus();
    // onRunQuery identity changes every render in the parent; depending on it
    // would re-fire this pivot on every keystroke elsewhere in the console.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusValue]);

  function submit(value: string) {
    const trimmed = value.trim();
    setSubmitted(trimmed);
    setShowSuggestions(false);
    onRunQuery(trimmed, runQuery(logs, trimmed, phase).length);
  }

  return (
    <div className="flex h-full flex-col">
      <form
        className="relative border-b border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        role="search"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              placeholder="Search the logs, e.g. source:dns host:WKS-HR-014"
              aria-label="Log search query"
              className="pl-8 font-mono text-xs"
            />
          </div>
          <Button type="submit" size="sm">
            Search
          </Button>
        </div>

        {hints.length > 0 ? (
          <ul className="absolute left-2 right-2 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            {hints.map((hint) => (
              <li key={hint.label}>
                <button
                  type="button"
                  className="flex w-full items-baseline gap-3 px-3 py-1.5 text-left hover:bg-accent"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setInput(hint.value);
                    inputRef.current?.focus();
                  }}
                >
                  <span className="font-mono text-xs">{hint.label}</span>
                  {hint.hint ? (
                    <span className="truncate text-[0.6875rem] text-muted-foreground">
                      {hint.hint}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[0.6875rem] text-muted-foreground">Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setInput(example);
                submit(example);
              }}
              className="rounded border border-border px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {results.length} {results.length === 1 ? "entry" : "entries"}
          {submitted ? (
            <>
              {" "}
              matching <span className="font-mono">{submitted}</span>
            </>
          ) : (
            " available at this phase"
          )}
        </p>
      </div>

      <ul className="scrollbar-thin flex-1 overflow-y-auto font-mono text-xs">
        {results.length === 0 ? (
          <li className="p-6 text-center text-muted-foreground">
            <p>Nothing matched.</p>
            <p className="mt-1 text-[0.6875rem]">
              A query returning nothing is a finding too - but check your spelling first.
            </p>
          </li>
        ) : null}

        {results.map((entry) => {
          const expanded = expandedId === entry.id;
          const taggableValues = [entry.domain, entry.src_ip, entry.dst_ip, entry.user].filter(
            (v): v is string => Boolean(v),
          );

          return (
            <li key={entry.id} className="border-b border-border/60">
              <button
                type="button"
                onClick={() => {
                  const next = expanded ? null : entry.id;
                  setExpandedId(next);
                  if (next) onViewEntry(entry);
                }}
                aria-expanded={expanded}
                className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
              >
                <ChevronRight
                  className={cn("mt-0.5 size-3 shrink-0 transition-transform", expanded && "rotate-90")}
                  aria-hidden
                />
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatUtc(entry.ts).slice(11, 19)}
                </span>
                <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[0.625rem]">
                  {entry.source}
                </Badge>
                <span className="min-w-0 flex-1 break-words">{entry.message}</span>
                {entry.severity ? (
                  <SeverityChip severity={entry.severity as Severity} className="shrink-0" />
                ) : null}
              </button>

              {expanded ? (
                <div className="space-y-3 border-t border-border/60 bg-secondary/40 px-8 py-3">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                    <dt className="text-muted-foreground">timestamp</dt>
                    <dd className="tabular-nums">{formatUtc(entry.ts)}</dd>
                    {(
                      [
                        ["host", entry.host],
                        ["user", entry.user],
                        ["src_ip", entry.src_ip],
                        ["dst_ip", entry.dst_ip],
                        ["domain", entry.domain],
                        ["action", entry.action],
                      ] as const
                    )
                      .filter(([, value]) => Boolean(value))
                      .map(([key, value]) => (
                        <React.Fragment key={key}>
                          <dt className="text-muted-foreground">{key}</dt>
                          <dd className="break-all">{value}</dd>
                        </React.Fragment>
                      ))}
                    {Object.entries(entry.fields).map(([key, value]) => (
                      <React.Fragment key={key}>
                        <dt className="text-muted-foreground">{key}</dt>
                        <dd className="break-words font-sans">{String(value)}</dd>
                      </React.Fragment>
                    ))}
                  </dl>

                  {taggableValues.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
                      <span className="font-sans text-[0.6875rem] text-muted-foreground">
                        Tag as indicator:
                      </span>
                      {[...new Set(taggableValues)].map((value) => (
                        <Button
                          key={value}
                          size="sm"
                          variant={tagged.has(value) ? "secondary" : "outline"}
                          className="h-6 gap-1 px-2 font-mono text-[0.6875rem]"
                          onClick={() => onTagValue(value, entry)}
                          disabled={tagged.has(value)}
                        >
                          <Tag className="size-3" />
                          {value}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
