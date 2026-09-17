import type { Metadata } from "next";

import { adminSignOut } from "@/app/actions/ctf-admin";
import { AdminSignInForm, ChallengeToggle, EventForm, PlayerActions } from "@/components/ctf/admin-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { adminConfigProblem, isAdmin } from "@/lib/ctf/admin";
import { getEvent } from "@/lib/ctf/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "CTF organiser",
  robots: { index: false, follow: false },
};

export default async function CtfAdminPage() {
  const problem = adminConfigProblem();

  if (problem) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>The organiser screen is not configured</CardTitle>
            <CardDescription>
              {problem === "no_passcode"
                ? "Set CTF_ADMIN_PASSCODE (at least 8 characters) in the environment, then redeploy."
                : "Set SUPABASE_SERVICE_ROLE_KEY in the environment. The organiser screen writes to tables players cannot touch."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!(await isAdmin())) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>CTF organiser</CardTitle>
            <CardDescription>Enter the organiser passcode to manage the event.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminSignInForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  const db = createAdminClient();
  const [event, eventRow, stats, players] = await Promise.all([
    getEvent(),
    db.from("ctf_event").select("*").eq("id", 1).maybeSingle(),
    db.from("ctf_challenge_stats").select("*").order("category").order("sort_order"),
    db
      .from("ctf_scoreboard")
      .select("*")
      .order("score", { ascending: false })
      .order("last_solve_at", { ascending: true, nullsFirst: false })
      .limit(500),
  ]);

  const row = eventRow.data;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">CTF organiser</h1>
          <p className="mt-1 text-muted-foreground">
            Status: <Badge variant="secondary">{event?.status ?? "unknown"}</Badge>
          </p>
        </div>
        <form action={adminSignOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event window</CardTitle>
            <CardDescription>
              Before the start players see a countdown. After the end submissions stop and the scoreboard freezes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventForm
              title={row?.title ?? "Nocturne CTF"}
              startsAt={row?.starts_at ?? null}
              endsAt={row?.ends_at ?? null}
              isActive={row?.is_active ?? true}
              hasPasscode={Boolean(row?.passcode_hash)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Challenges</CardTitle>
            <CardDescription>Switched-off challenges disappear for players and stop counting.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-2">Challenge</th>
                  <th scope="col" className="px-2 py-2 text-right">Attempts</th>
                  <th scope="col" className="px-2 py-2 text-right">Solves</th>
                  <th scope="col" className="px-2 py-2 text-right">Players</th>
                  <th scope="col" className="py-2 pl-2 text-right">Active</th>
                </tr>
              </thead>
              <tbody>
                {(stats.data ?? []).map((challenge) => (
                  <tr key={challenge.slug} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-2">
                      <div className="font-medium">{challenge.title}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {challenge.category} - {challenge.points} pts
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{challenge.attempts}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{challenge.solves}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{challenge.players}</td>
                    <td className="py-2 pl-2 text-right">
                      <ChallengeToggle slug={challenge.slug} active={challenge.is_active} title={challenge.title} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stats.error ? <p className="text-sm text-destructive">{stats.error.message}</p> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Players ({players.data?.length ?? 0})</CardTitle>
          <CardDescription>Submitted guesses are never shown here or anywhere else in the interface.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(players.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody has joined yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-2">Handle</th>
                  <th scope="col" className="px-2 py-2">Team</th>
                  <th scope="col" className="px-2 py-2 text-right">Solves</th>
                  <th scope="col" className="px-2 py-2 text-right">Hint cost</th>
                  <th scope="col" className="px-2 py-2 text-right">Score</th>
                  <th scope="col" className="py-2 pl-2 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(players.data ?? []).map((player) => (
                  <tr key={player.player_id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-2 font-medium">{player.handle}</td>
                    <td className="px-2 py-2 text-muted-foreground">{player.team_name ?? "-"}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{player.solves}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{player.hint_cost}</td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">{player.score}</td>
                    <td className="py-2 pl-2">
                      <PlayerActions playerId={player.player_id} handle={player.handle} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
