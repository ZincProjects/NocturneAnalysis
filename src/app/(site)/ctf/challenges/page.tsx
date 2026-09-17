import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Droplet, Lightbulb, Paperclip } from "lucide-react";

import { Countdown } from "@/components/ctf/countdown";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getPlayerState } from "@/lib/ctf/server";
import { CTF_CATEGORIES } from "@/lib/ctf/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "CTF challenges" };

export default async function CtfChallengesPage() {
  const state = await getPlayerState();
  if (!state) redirect("/ctf");

  const { player, event, challenges } = state;
  const totalPoints = challenges.reduce((sum, c) => sum + c.points, 0);
  const solved = challenges.filter((c) => c.solved).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Challenges</h1>
          <p className="mt-2 text-muted-foreground">
            Playing as <span className="font-medium text-foreground">{player.handle}</span>
            {player.team_name ? ` - ${player.team_name}` : ""}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 text-sm sm:min-w-[28rem]">
          <div className="rounded-lg border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">Score</dt>
            <dd className="font-mono text-2xl font-semibold tabular-nums">{player.score}</dd>
            {player.hint_cost > 0 ? (
              <dd className="text-xs text-muted-foreground">-{player.hint_cost} on hints</dd>
            ) : null}
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">Rank</dt>
            <dd className="font-mono text-2xl font-semibold tabular-nums">
              {player.rank}
              <span className="text-sm text-muted-foreground">/{player.player_count}</span>
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">
              {event.status === "live" ? "Time left" : event.status === "upcoming" ? "Starts in" : "Status"}
            </dt>
            <dd className="font-mono text-lg font-semibold tabular-nums">
              {event.status === "live" && event.ends_at ? (
                <Countdown size="sm" target={event.ends_at} serverNow={event.server_now} />
              ) : event.status === "upcoming" && event.starts_at ? (
                <Countdown size="sm" target={event.starts_at} serverNow={event.server_now} />
              ) : event.status === "ended" ? (
                "Ended"
              ) : (
                "Paused"
              )}
            </dd>
          </div>
        </dl>
      </header>

      {event.status === "upcoming" && event.starts_at ? (
        <Card className="mt-10">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <h2 className="text-xl font-semibold">You are registered. The challenges unlock in</h2>
            <Countdown target={event.starts_at} serverNow={event.server_now} />
            <p className="text-sm text-muted-foreground">This page refreshes on its own when the CTF starts.</p>
          </CardContent>
        </Card>
      ) : challenges.length === 0 ? (
        <Card className="mt-10">
          <CardContent className="py-12 text-center text-muted-foreground">
            {event.status === "inactive" || event.status === "unscheduled"
              ? "The organiser has paused the CTF. Hang tight."
              : "No challenges are switched on right now."}
          </CardContent>
        </Card>
      ) : (
        <>
          {event.status === "ended" ? (
            <p className="mt-6 rounded-md border border-border bg-secondary/50 px-4 py-3 text-sm">
              This round has ended. Submissions are closed, and every challenge now shows its write-up.
            </p>
          ) : null}

          <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
            <Progress value={challenges.length ? (solved / challenges.length) * 100 : 0} className="h-2 max-w-xs" />
            <span>
              {solved}/{challenges.length} solved - {totalPoints} points available
            </span>
          </div>

          <div className="mt-8 space-y-10">
            {CTF_CATEGORIES.map((category) => {
              const items = challenges.filter((c) => c.category === category.key);
              if (items.length === 0) return null;
              const done = items.filter((c) => c.solved).length;
              return (
                <section key={category.key} aria-labelledby={`cat-${category.key}`}>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h2 id={`cat-${category.key}`} className="text-lg font-semibold">
                        {category.label}
                      </h2>
                      <p className="text-sm text-muted-foreground">{category.blurb}</p>
                    </div>
                    <Badge variant={done === items.length ? "success" : "secondary"}>
                      {done}/{items.length} {category.label} solved
                    </Badge>
                  </div>
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {items.map((challenge) => (
                      <li key={challenge.slug}>
                        <Link
                          href={`/ctf/challenges/${challenge.slug}`}
                          className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                        >
                          <Card
                            className={cn(
                              "flex h-full flex-col transition-colors group-hover:border-primary/60",
                              challenge.solved && "border-chart-5/50 bg-chart-5/5",
                            )}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-2">
                                <CardTitle className="text-base">{challenge.title}</CardTitle>
                                {challenge.solved ? (
                                  <CheckCircle2 className="size-5 shrink-0 text-chart-5" aria-label="Solved" />
                                ) : null}
                              </div>
                            </CardHeader>
                            <CardContent className="mt-auto space-y-3">
                              <div className="font-mono text-2xl font-semibold text-primary tabular-nums">
                                {challenge.points}
                                <span className="ml-1 text-xs font-normal text-muted-foreground">pts</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Droplet className="size-3" aria-hidden />
                                  {challenge.solve_count} {challenge.solve_count === 1 ? "solve" : "solves"}
                                </span>
                                {challenge.hint_count > 0 ? (
                                  <span className="flex items-center gap-1">
                                    <Lightbulb className="size-3" aria-hidden />
                                    {challenge.hints_revealed}/{challenge.hint_count} hints
                                  </span>
                                ) : null}
                                {challenge.has_file ? (
                                  <span className="flex items-center gap-1">
                                    <Paperclip className="size-3" aria-hidden /> file
                                  </span>
                                ) : null}
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
