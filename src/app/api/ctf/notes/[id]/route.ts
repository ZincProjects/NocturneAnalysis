import { NextResponse, type NextRequest } from "next/server";

import { ctfDb, ctfErrorCode, ctfMessage, readPlayerToken } from "@/lib/ctf/server";

/**
 * "Sequential Secrets" - a DELIBERATELY VULNERABLE endpoint for the CTF.
 *
 * It checks that the caller has joined, then returns whichever note the URL
 * names without asking whether that note belongs to them. That missing
 * ownership check is the challenge (OWASP A01:2021, Broken Access Control).
 * Do not copy this pattern anywhere else.
 */

export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = ctfDb();
  const token = await readPlayerToken();

  if (!db) return NextResponse.json({ error: "Notes service unavailable" }, { status: 503, headers: HEADERS });
  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized", detail: "Join Nocturne CTF at /ctf to use Northwind Notes." },
      { status: 401, headers: HEADERS },
    );
  }

  const noteId = Number(id);
  if (!Number.isInteger(noteId) || noteId < 0 || noteId > 1_000_000) {
    return NextResponse.json({ error: "Bad note id" }, { status: 400, headers: HEADERS });
  }

  const { data, error } = await db.rpc("ctf_note", { p_token: token, p_id: noteId });
  if (error) {
    const code = ctfErrorCode(error);
    const status = code === "no_player" ? 401 : code === "not_live" ? 403 : 500;
    return NextResponse.json({ error: ctfMessage(code) }, { status, headers: HEADERS });
  }
  if (!data) return NextResponse.json({ error: "Note not found" }, { status: 404, headers: HEADERS });

  return NextResponse.json({ service: "Northwind Notes v0.9", note: data }, { headers: HEADERS });
}
