import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import { isEventType, isPhaseKey } from "@/lib/events/types";

/**
 * POST target for `logEvent()`.
 *
 * This is a thin authenticated proxy in front of the `append-event` Edge
 * Function, not a second implementation of it. Every rule that matters - who
 * may write which event type, who owns the session, what time it is, what the
 * hash is - lives in the Edge Function, because that is the boundary the
 * database actually trusts. Duplicating those checks here would mean two
 * places to keep in step and one of them eventually being wrong.
 *
 * What this route adds is the session token. The browser holds its Supabase
 * session in httpOnly cookies, which it cannot read to build an Authorization
 * header itself, so the server reads the cookie and forwards the bearer token.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;

  // Reject obvious nonsense before spending a function invocation on it. The
  // Edge Function re-checks all of this; this is a fast path, not the gate.
  if (typeof input.session_id !== "string") {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }
  if (!isEventType(input.event_type)) {
    return NextResponse.json(
      { error: `Unknown event_type: ${String(input.event_type)}` },
      { status: 400 },
    );
  }
  if (input.phase !== null && input.phase !== undefined && !isPhaseKey(input.phase)) {
    return NextResponse.json({ error: `Unknown phase: ${String(input.phase)}` }, { status: 400 });
  }

  const { url, anonKey } = requireSupabaseEnv();

  let upstream: Response;
  try {
    upstream = await fetch(`${url}/functions/v1/append-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        session_id: input.session_id,
        event_type: input.event_type,
        phase: input.phase ?? null,
        payload: input.payload ?? {},
        client_meta: input.client_meta ?? null,
      }),
    });
  } catch (err) {
    // The console keeps a local outbox and retries, so it needs to be able to
    // tell "the network failed" from "the server said no".
    return NextResponse.json(
      { error: "Could not reach the event service", detail: (err as Error).message },
      { status: 502 },
    );
  }

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
