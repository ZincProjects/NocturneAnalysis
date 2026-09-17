import { NextResponse } from "next/server";

import { getScoreboard } from "@/lib/ctf/server";

/** Polled every few seconds by the public scoreboard. Handles and scores only. */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const board = await getScoreboard();
    if (!board) return NextResponse.json({ error: "The CTF is not configured" }, { status: 503 });
    return NextResponse.json(board, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load the scoreboard" }, { status: 500 });
  }
}
