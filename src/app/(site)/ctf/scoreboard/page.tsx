import type { Metadata } from "next";

import { LiveScoreboard } from "@/components/ctf/live-scoreboard";
import { getPlayerState, getScoreboard } from "@/lib/ctf/server";

export const metadata: Metadata = {
  title: "CTF scoreboard",
  description: "Live standings for Nocturne CTF.",
};

export default async function CtfScoreboardPage() {
  const [board, state] = await Promise.all([getScoreboard(), getPlayerState()]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{board?.event.title ?? "Nocturne CTF"} scoreboard</h1>
        <p className="mt-2 text-muted-foreground">Updates every few seconds. Put it on the projector.</p>
      </header>
      {board ? (
        <LiveScoreboard initial={board} highlight={state?.player.handle ?? null} />
      ) : (
        <p className="text-muted-foreground">The CTF is not configured on this deployment.</p>
      )}
    </div>
  );
}
