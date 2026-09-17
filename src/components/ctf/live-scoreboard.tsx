"use client";

import { useEffect, useState } from "react";
import { Droplet, Snowflake, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CtfScoreboard } from "@/lib/ctf/types";
import { cn } from "@/lib/utils";

import { Countdown } from "./countdown";

const POLL_MS = 5000;

function timeOf(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/**
 * Polls every five seconds rather than holding a Realtime socket open: a
 * projector left on the scoreboard for an afternoon should not depend on a
 * websocket surviving school Wi-Fi, and the table is small.
 */
export function LiveScoreboard({ initial, highlight }: { initial: CtfScoreboard; highlight: string | null }) {
  const [board, setBoard] = useState(initial);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/ctf/scoreboard", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const next = (await response.json()) as CtfScoreboard;
        if (!cancelled) {
          setBoard(next);
          setStale(false);
        }
      } catch {
        if (!cancelled) setStale(true);
      }
    };
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const { event, rows, challenges } = board;
  const top = rows[0]?.score ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {event.status === "live" && event.ends_at ? (
          <Badge variant="success" className="gap-2 px-3 py-1 text-sm">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-chart-5 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-chart-5" />
            </span>
            Live - ends in <Countdown size="sm" target={event.ends_at} serverNow={event.server_now} />
          </Badge>
        ) : event.status === "upcoming" && event.starts_at ? (
          <Badge variant="secondary" className="px-3 py-1 text-sm">
            Starts in <Countdown size="sm" target={event.starts_at} serverNow={event.server_now} />
          </Badge>
        ) : event.status === "ended" ? (
          <Badge variant="outline" className="gap-1.5 px-3 py-1 text-sm">
            <Snowflake className="size-3.5" aria-hidden /> Final standings - scoreboard frozen
          </Badge>
        ) : (
          <Badge variant="outline" className="px-3 py-1 text-sm">
            Not running
          </Badge>
        )}
        <span className="text-muted-foreground">
          {rows.length} {rows.length === 1 ? "player" : "players"}
        </span>
        {stale ? <span className="text-xs text-destructive">Reconnecting...</span> : null}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardContent className="p-0">
            {rows.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground">No players yet. Be the first to join.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm lg:text-base">
                  <caption className="sr-only">Scoreboard, highest score first</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                      <th scope="col" className="w-14 px-4 py-3">#</th>
                      <th scope="col" className="px-4 py-3">Player</th>
                      <th scope="col" className="px-4 py-3 text-right">Solves</th>
                      <th scope="col" className="hidden px-4 py-3 text-right sm:table-cell">Last solve</th>
                      <th scope="col" className="px-4 py-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr
                        key={row.handle}
                        className={cn(
                          "border-b border-border/60 last:border-0",
                          row.handle === highlight && "bg-primary/10",
                        )}
                      >
                        <td className="px-4 py-3 font-mono tabular-nums">
                          {i === 0 && row.score > 0 ? (
                            <Trophy className="size-4 text-[var(--sev-medium)]" aria-label="1st" />
                          ) : (
                            i + 1
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{row.handle}</span>
                            {row.handle === highlight ? <Badge variant="default">You</Badge> : null}
                            {row.first_bloods > 0 ? (
                              <span
                                className="inline-flex items-center gap-0.5 rounded-full bg-[var(--sev-critical)]/15 px-1.5 py-0.5 text-xs text-[var(--sev-critical)]"
                                title={`First to solve ${row.first_bloods} ${row.first_bloods === 1 ? "challenge" : "challenges"}`}
                              >
                                <Droplet className="size-3" aria-hidden />
                                <span className="sr-only">First bloods:</span>
                                {row.first_bloods}
                              </span>
                            ) : null}
                          </div>
                          {row.team_name ? <div className="text-xs text-muted-foreground">{row.team_name}</div> : null}
                          <div className="mt-1 h-1 rounded-full bg-secondary" aria-hidden>
                            <div
                              className="h-1 rounded-full bg-primary transition-[width] duration-700"
                              style={{ width: `${top > 0 ? Math.max(0, (row.score / top) * 100) : 0}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.solves}</td>
                        <td className="hidden px-4 py-3 text-right font-mono text-xs text-muted-foreground tabular-nums sm:table-cell">
                          {timeOf(row.last_solve_at)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-lg font-semibold tabular-nums">{row.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Droplet className="size-4 text-[var(--sev-critical)]" aria-hidden /> First bloods
            </CardTitle>
            <CardDescription>The first player to solve each challenge.</CardDescription>
          </CardHeader>
          <CardContent>
            {challenges.length === 0 ? (
              <p className="text-sm text-muted-foreground">Challenges appear when the CTF starts.</p>
            ) : (
              <ul className="space-y-2.5">
                {challenges.map((challenge) => (
                  <li key={challenge.title} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{challenge.title}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {challenge.category} - {challenge.points} pts - {challenge.solves}{" "}
                        {challenge.solves === 1 ? "solve" : "solves"}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {challenge.first_blood ? (
                        <>
                          <div className="font-medium text-[var(--sev-critical)]">{challenge.first_blood}</div>
                          <div className="font-mono text-xs text-muted-foreground">{timeOf(challenge.first_blood_at)}</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unclaimed</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
