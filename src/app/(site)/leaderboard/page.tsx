import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EyeOff, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatUtc } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Leaderboard",
  robots: { index: false, follow: false },
};

/**
 * Per-organisation leaderboard, showing pseudonyms only.
 *
 * Two deliberate constraints:
 *
 *   * It is **off by default**. Some schools do not want competitive ranking
 *     between students, and the private option should never be the one you
 *     have to opt out of.
 *   * It shows `handle`, never `display_name`. The underlying view does not
 *     even select the real name, so this page could not leak it by accident.
 *     A meaningful share of users here are minors.
 */
export default async function LeaderboardPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/leaderboard");

  if (!viewer.org.leaderboard_enabled) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <EyeOff className="size-5 text-muted-foreground" aria-hidden />
              The leaderboard is switched off
            </CardTitle>
            <CardDescription>
              {viewer.org.name} has not enabled competitive ranking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Leaderboards are off by default in NocturneAnalysis. Ranking students against each
              other suits some classrooms and not others, and where many learners are minors the
              more private setting should be the one that requires no action.
            </p>
            <p>An administrator at your institution can enable it if your cohort wants it.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("leaderboard_entries")
    .select("*")
    .eq("org_id", viewer.profile.org_id)
    .order("total_score", { ascending: false })
    .limit(100);

  const rows = (entries ?? []).filter((e) => (e.completed_sessions ?? 0) > 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Trophy className="size-6 text-primary" aria-hidden />
          Leaderboard
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {viewer.org.name}. Analysts appear under their chosen handle; real names are never shown
          here.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nobody has completed a scenario yet. Be first.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Analysts ranked by total score across completed scenarios
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-4 font-medium">
                  #
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Analyst
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Cohort
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Completed
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Total score
                </th>
                <th scope="col" className="py-2 font-medium">
                  Last incident
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry, index) => {
                const isYou = entry.handle === viewer.profile.handle;
                return (
                  <tr
                    key={`${entry.handle}-${index}`}
                    className={isYou ? "bg-primary/5" : "border-b border-border/60"}
                  >
                    <td className="py-2 pr-4 font-mono tabular-nums text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="py-2 pr-4 font-medium">
                      {entry.handle}
                      {isYou ? (
                        <Badge variant="default" className="ml-2">
                          you
                        </Badge>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{entry.cohort ?? "—"}</td>
                    <td className="py-2 pr-4 tabular-nums">{entry.completed_sessions}</td>
                    <td className="py-2 pr-4 tabular-nums font-medium">{entry.total_score}</td>
                    <td className="py-2 text-muted-foreground">
                      {entry.last_completed_at ? formatUtc(entry.last_completed_at).slice(0, 10) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Scores combine decisions, response actions, indicators correctly identified and the
        post-incident review, less any hints used and false positives tagged. A high score is not
        the same as a good analyst, and speed is not on this table on purpose.
      </p>
    </div>
  );
}
