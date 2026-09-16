"use client";

import * as React from "react";
import Link from "next/link";
import { Radio } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { PHASE_KEYS, PHASE_LABELS, type PhaseKey } from "@/lib/events/types";
import { cn, formatDuration } from "@/lib/utils";

/**
 * The live class view.
 *
 * Subscribes to Supabase Realtime for session changes in this organisation, so
 * an instructor walking a lab can see who is stuck in investigation and who
 * has raced to containment without reading anything - while it is still useful
 * to walk over and ask.
 *
 * Realtime respects Row Level Security, so the subscription cannot deliver a
 * session from another institution even though the filter is client-side.
 */

export interface LiveSession {
  id: string;
  handle: string;
  cohort: string | null;
  scenarioTitle: string;
  phase: PhaseKey;
  startedAt: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  scenario_id: string;
  org_id: string;
  status: string;
  current_phase: PhaseKey;
  started_at: string;
}

export function LiveClassFeed({
  orgId,
  initial,
  scenarioTitles,
  handles,
}: {
  orgId: string;
  initial: LiveSession[];
  scenarioTitles: Record<string, string>;
  handles: Record<string, string>;
}) {
  const [sessions, setSessions] = React.useState<LiveSession[]>(initial);
  const [connected, setConnected] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`class-view-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `org_id=eq.${orgId}` },
        (payload) => {
          const row = payload.new as SessionRow | null;
          if (!row) return;

          setSessions((prev) => {
            // A submitted session is no longer "working now".
            if (row.status !== "in_progress") return prev.filter((s) => s.id !== row.id);

            const entry: LiveSession = {
              id: row.id,
              handle: handles[row.user_id] ?? "unknown",
              cohort: prev.find((s) => s.id === row.id)?.cohort ?? null,
              scenarioTitle: scenarioTitles[row.scenario_id] ?? "Unknown scenario",
              phase: row.current_phase,
              startedAt: row.started_at,
            };

            const existing = prev.findIndex((s) => s.id === row.id);
            if (existing === -1) return [entry, ...prev];

            const next = [...prev];
            next[existing] = { ...next[existing], ...entry };
            return next;
          });
        },
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, scenarioTitles, handles]);

  const byPhase = React.useMemo(() => {
    const map = new Map<PhaseKey, LiveSession[]>();
    for (const phase of PHASE_KEYS) map.set(phase, []);
    for (const session of sessions) map.get(session.phase)?.push(session);
    return map;
  }, [sessions]);

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
        <Radio
          className={cn("size-3.5", connected ? "text-chart-5" : "text-muted-foreground")}
          aria-hidden
        />
        {connected ? "Live" : "Connecting…"} &middot; {sessions.length}{" "}
        {sessions.length === 1 ? "student" : "students"} working
      </p>

      {sessions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nobody is in a scenario right now.
        </p>
      ) : (
        <div className="scrollbar-thin overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {PHASE_KEYS.map((phase) => {
              const inPhase = byPhase.get(phase) ?? [];
              return (
                <div key={phase} className="w-52 shrink-0">
                  <div className="mb-2 flex items-center justify-between border-b border-border pb-1.5">
                    <p className="text-xs font-semibold">{PHASE_LABELS[phase]}</p>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {inPhase.length}
                    </span>
                  </div>

                  <ul className="space-y-1.5">
                    {inPhase.map((session) => (
                      <li key={session.id}>
                        <Button
                          variant="ghost"
                          asChild
                          className="h-auto w-full justify-start whitespace-normal p-2 text-left"
                        >
                          <Link href={`/admin/sessions/${session.id}`}>
                            <span className="block w-full">
                              <span className="block text-sm font-medium">{session.handle}</span>
                              <span className="block truncate text-[0.6875rem] text-muted-foreground">
                                {session.scenarioTitle}
                              </span>
                              <span className="block font-mono text-[0.6875rem] tabular-nums text-muted-foreground">
                                {formatDuration(now - Date.parse(session.startedAt))}
                                {session.cohort ? ` · ${session.cohort}` : ""}
                              </span>
                            </span>
                          </Link>
                        </Button>
                      </li>
                    ))}
                    {inPhase.length === 0 ? (
                      <li className="rounded border border-dashed border-border/60 p-2 text-center text-[0.6875rem] text-muted-foreground">
                        —
                      </li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        A student sitting in Investigation for a long time is usually stuck rather than thorough.
        One who reaches Containment in four minutes has probably not read the evidence. Both are
        worth a word, and this view exists so you can have it during the lesson rather than after
        it.
      </p>

      <Badge variant="outline" className="gap-1">
        Handles only
      </Badge>
    </div>
  );
}
