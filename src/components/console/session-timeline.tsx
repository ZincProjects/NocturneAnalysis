"use client";

import * as React from "react";
import { Download, Link2, ShieldCheck, ShieldX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatUtc } from "@/lib/utils";
import { shortHash, verifyChain, type ChainVerification } from "@/lib/events/hash";
import type { EventType, SessionEvent } from "@/lib/events/types";

/**
 * The student's own audit log, shown to them while they work.
 *
 * Making the chain visible is the whole point of building it this way. A
 * student who can watch each of their actions become a hash that depends on
 * the previous one has understood chain of custody in a way no slide achieves,
 * and "verify" is not a metaphor here - it recomputes every digest in the
 * browser from the events themselves.
 */

const EVENT_LABELS: Partial<Record<EventType, string>> = {
  SESSION_START: "Session started",
  SESSION_PAUSE: "Paused",
  SESSION_RESUME: "Resumed",
  SESSION_COMPLETE: "Session complete",
  VIEW_ALERT: "Opened alert",
  RUN_QUERY: "Ran query",
  VIEW_LOG_ENTRY: "Read log entry",
  TAG_IOC: "Tagged indicator",
  UNTAG_IOC: "Removed indicator",
  ADD_NOTE: "Added note",
  SUBMIT_DECISION: "Recorded decision",
  REQUEST_HINT: "Requested hint",
  PHASE_TRANSITION: "Moved phase",
  CONTAIN_HOST: "Isolated host",
  ISOLATE_ACCOUNT: "Disabled account",
  BLOCK_INDICATOR: "Blocked indicator",
  ESCALATE: "Escalated",
  DOWNLOAD_ARTIFACT: "Requested artefact",
  SUBMIT_REPORT: "Submitted report",
  INSTRUCTOR_COMMENT: "Instructor comment",
  GRADE_ASSIGNED: "Grade assigned",
};

function summarise(event: SessionEvent): string {
  const p = event.payload as Record<string, unknown>;
  switch (event.event_type) {
    case "RUN_QUERY":
      return `${String(p.query ?? "")} → ${String(p.result_count ?? 0)} results`;
    case "TAG_IOC":
    case "UNTAG_IOC":
      return String(p.value ?? "");
    case "SUBMIT_DECISION":
      return `${String(p.decision_key ?? "")} = ${
        Array.isArray(p.decision_value) ? p.decision_value.join(", ") : String(p.decision_value ?? "")
      }`;
    case "VIEW_ALERT":
      return String(p.alert_id ?? "");
    case "VIEW_LOG_ENTRY":
      return String(p.log_id ?? "");
    case "ADD_NOTE":
      return String(p.text ?? "").slice(0, 90);
    case "PHASE_TRANSITION":
      return `${String(p.from ?? "start")} → ${String(p.to ?? "")}`;
    case "REQUEST_HINT":
      return `${String(p.hint_key ?? "")} (-${String(p.cost ?? 0)})`;
    case "CONTAIN_HOST":
    case "ISOLATE_ACCOUNT":
    case "BLOCK_INDICATOR":
    case "ESCALATE":
    case "DOWNLOAD_ARTIFACT":
      return String(p.target ?? "");
    default:
      return "";
  }
}

export function SessionTimeline({
  events,
  sessionId,
}: {
  events: SessionEvent[];
  sessionId: string;
}) {
  const [verification, setVerification] = React.useState<ChainVerification | null>(null);
  const [verifying, setVerifying] = React.useState(false);

  // Optimistic rows have not been sealed yet, so they are excluded from the
  // integrity check - verifying an event the server has not acknowledged would
  // always fail and would be alarming rather than informative.
  const sealed = React.useMemo(() => events.filter((e) => e.hash), [events]);

  async function verify() {
    setVerifying(true);
    try {
      setVerification(await verifyChain(sealed));
    } finally {
      setVerifying(false);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(sealed, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nocturne-session-${sessionId.slice(0, 8)}-events.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
        <Button size="sm" variant="outline" onClick={verify} disabled={verifying || sealed.length === 0}>
          <ShieldCheck className="size-3.5" />
          Verify chain
        </Button>
        <Button size="sm" variant="ghost" onClick={exportJson} disabled={sealed.length === 0}>
          <Download className="size-3.5" />
          Export JSON
        </Button>

        {verification ? (
          <Badge variant={verification.valid ? "success" : "destructive"} className="ml-auto">
            {verification.valid ? (
              <ShieldCheck className="size-3" />
            ) : (
              <ShieldX className="size-3" />
            )}
            {verification.valid
              ? `${verification.length} events intact`
              : `Broken at #${(verification.brokenAtIndex ?? 0) + 1}`}
          </Badge>
        ) : null}
      </div>

      {verification && !verification.valid ? (
        <p className="border-b border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {verification.reason}
        </p>
      ) : null}

      {verification?.valid ? (
        <p className="border-b border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
          Every hash was recomputed from the event contents and matched, and each event points at the
          one before it. Head: <span className="font-mono">{shortHash(verification.headHash)}</span>
        </p>
      ) : null}

      <ol className="scrollbar-thin flex-1 overflow-y-auto">
        {events.map((event, index) => (
          <li
            key={event.id}
            className={cn(
              "border-b border-border/60 px-3 py-2",
              verification?.brokenAtIndex === index && "bg-destructive/10",
            )}
          >
            <div className="flex items-baseline gap-2">
              <span className="w-8 shrink-0 text-right font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span className="shrink-0 font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                {formatUtc(event.created_at).slice(11, 19)}
              </span>
              <span className="text-xs font-medium">
                {EVENT_LABELS[event.event_type] ?? event.event_type}
              </span>
              {event.phase ? (
                <Badge variant="secondary" className="px-1.5 py-0 text-[0.625rem]">
                  {event.phase.replace(/_/g, " ")}
                </Badge>
              ) : null}
            </div>

            {summarise(event) ? (
              <p className="ml-10 mt-0.5 break-words font-mono text-[0.6875rem] text-muted-foreground">
                {summarise(event)}
              </p>
            ) : null}

            <p className="ml-10 mt-0.5 flex items-center gap-1 font-mono text-[0.625rem] text-muted-foreground/70">
              <Link2 className="size-2.5" aria-hidden />
              {event.hash ? shortHash(event.hash) : "sealing…"}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
