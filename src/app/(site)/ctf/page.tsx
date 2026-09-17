import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Binary, FileSearch, Globe, Puzzle, Timer, Trophy } from "lucide-react";

import { leaveCtf } from "@/app/actions/ctf";
import { Countdown } from "@/components/ctf/countdown";
import { JoinForm } from "@/components/ctf/join-form";
import { LocalTime } from "@/components/ctf/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEvent, getPlayerState } from "@/lib/ctf/server";
import type { CtfEvent } from "@/lib/ctf/types";

export const metadata: Metadata = {
  title: "Nocturne CTF",
  description:
    "A short capture-the-flag warm-up: eight challenges across web, crypto, forensics and misc, set in the same fictional Northwind Polytechnic as the SOC scenarios.",
};

const CATEGORY_CARDS = [
  { icon: Globe, label: "Web", text: "Read what a site tells robots, and what an API forgets to check." },
  { icon: Binary, label: "Crypto", text: "Break a Caesar cipher and brute-force a single-byte XOR key." },
  { icon: FileSearch, label: "Forensics", text: "Dig through image metadata and a workstation's DNS log." },
  { icon: Puzzle, label: "Misc", text: "Name an ATT&CK technique, then find a message hidden in pixels." },
];

function EventStatus({ event }: { event: CtfEvent }) {
  if (event.status === "upcoming" && event.starts_at) {
    return (
      <div className="space-y-3">
        <Badge variant="secondary">Starts <LocalTime iso={event.starts_at} /></Badge>
        <Countdown target={event.starts_at} serverNow={event.server_now} />
      </div>
    );
  }
  if (event.status === "live" && event.ends_at) {
    return (
      <div className="space-y-3">
        <Badge variant="success">Live now - ends <LocalTime iso={event.ends_at} /></Badge>
        <Countdown target={event.ends_at} serverNow={event.server_now} />
      </div>
    );
  }
  if (event.status === "ended") {
    return <Badge variant="outline">This round ended <LocalTime iso={event.ends_at} />. The final scoreboard is up.</Badge>;
  }
  return <Badge variant="outline">No round is scheduled right now.</Badge>;
}

export default async function CtfLandingPage() {
  const [event, state] = await Promise.all([getEvent(), getPlayerState()]);

  if (!event) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Nocturne CTF</h1>
        <p className="mt-3 text-muted-foreground">
          The CTF is not configured on this deployment. It needs the same Supabase settings as the rest of the
          site.
        </p>
      </div>
    );
  }

  const canJoin = event.status === "live" || event.status === "upcoming";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 lg:py-14">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-8">
          <header className="space-y-4">
            <p className="font-mono text-sm text-primary">{"// capture the flag"}</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{event.title}</h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Eight challenges, one scoreboard, one sitting. Pick a handle, find the flags hidden around a
              fictional Northwind Polytechnic, and watch the leaderboard move. Every target here is fake and lives
              inside this site.
            </p>
            <EventStatus event={event} />
          </header>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CATEGORY_CARDS.map(({ icon: Icon, label, text }) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="size-4 text-primary" aria-hidden /> {label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">How it works</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <li>
                  <strong className="text-foreground">Flags</strong> look like <code className="font-mono">flag{"{...}"}</code>.
                  Case does not matter.
                </li>
                <li>
                  <strong className="text-foreground">Hints</strong> cost points, shown before you reveal one.
                </li>
                <li>
                  <strong className="text-foreground">Five wrong guesses</strong> in a row lock that challenge for a
                  minute. Think, do not spray.
                </li>
                <li>
                  <strong className="text-foreground">Ties</strong> go to whoever reached the score first. The first
                  solver of each challenge gets a first-blood marker.
                </li>
                <li className="sm:col-span-2">
                  <strong className="text-foreground">Stay in scope.</strong> Only attack the pages and files the
                  challenges point you to. Never try these techniques on systems you do not have permission to test.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            {state ? (
              <>
                <CardHeader>
                  <CardTitle>You are in</CardTitle>
                  <CardDescription>
                    Playing as <span className="font-medium text-foreground">{state.player.handle}</span>
                    {state.player.team_name ? ` (${state.player.team_name})` : ""}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-secondary/60 p-3">
                      <dt className="text-xs text-muted-foreground">Score</dt>
                      <dd className="font-mono text-2xl font-semibold">{state.player.score}</dd>
                    </div>
                    <div className="rounded-md bg-secondary/60 p-3">
                      <dt className="text-xs text-muted-foreground">Rank</dt>
                      <dd className="font-mono text-2xl font-semibold">
                        {state.player.rank}
                        <span className="text-sm text-muted-foreground">/{state.player.player_count}</span>
                      </dd>
                    </div>
                  </dl>
                  <Button asChild className="w-full">
                    <Link href="/ctf/challenges">
                      Go to challenges <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                  <form action={leaveCtf}>
                    <Button type="submit" variant="ghost" size="sm" className="w-full text-muted-foreground">
                      Not you? Leave this browser (the handle cannot be reclaimed)
                    </Button>
                  </form>
                </CardContent>
              </>
            ) : canJoin ? (
              <>
                <CardHeader>
                  <CardTitle>Join the CTF</CardTitle>
                  <CardDescription>
                    {event.status === "upcoming"
                      ? "Register now and the challenges unlock when the countdown ends."
                      : "Pick a handle and you are straight in."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <JoinForm requiresPasscode={event.requires_passcode} />
                </CardContent>
              </>
            ) : (
              <CardHeader>
                <CardTitle>Joining is closed</CardTitle>
                <CardDescription>
                  {event.status === "ended"
                    ? "This round is over. Check the final standings."
                    : "Ask your organiser when the next round opens."}
                </CardDescription>
              </CardHeader>
            )}
          </Card>

          <Button asChild variant="outline" className="w-full">
            <Link href="/ctf/scoreboard">
              <Trophy aria-hidden /> Live scoreboard
            </Link>
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Timer className="size-3.5" aria-hidden /> Takes 30 to 90 minutes. Want the full SOC experience after?
            Try the <Link href="/scenarios" className="underline underline-offset-2">incident scenarios</Link>.
          </p>
        </aside>
      </div>
    </div>
  );
}
