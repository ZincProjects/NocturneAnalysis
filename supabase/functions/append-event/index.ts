/**
 * append-event
 *
 * The only way a row reaches `session_events`. Everything else in the system
 * has SELECT on that table and nothing more.
 *
 * What this function is actually for: the hash chain is only worth something
 * if the browser cannot choose its own hashes or timestamps. So the client
 * sends an event type and a payload; the server decides when it happened,
 * looks up the true head of the chain, computes the digest, and appends.
 *
 * Checks performed on every call, in order:
 *   1. The caller has a valid Supabase JWT.
 *   2. The event type is one the caller's role is allowed to write. Students
 *      cannot write GRADE_ASSIGNED or INSTRUCTOR_COMMENT, however they craft
 *      the request.
 *   3. The caller owns the session, or is staff in the session's organization.
 *   4. The session is still open. A submitted session accepts nothing further
 *      from the student.
 *
 * Deployed with verify_jwt enabled, so an unauthenticated request never
 * reaches this code at all.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

import { computeEventHash } from "../_shared/hash.ts";

const EVENT_TYPES = [
  "SESSION_START",
  "SESSION_PAUSE",
  "SESSION_RESUME",
  "SESSION_COMPLETE",
  "VIEW_ALERT",
  "RUN_QUERY",
  "VIEW_LOG_ENTRY",
  "TAG_IOC",
  "UNTAG_IOC",
  "ADD_NOTE",
  "SUBMIT_DECISION",
  "REQUEST_HINT",
  "PHASE_TRANSITION",
  "CONTAIN_HOST",
  "ISOLATE_ACCOUNT",
  "BLOCK_INDICATOR",
  "ESCALATE",
  "DOWNLOAD_ARTIFACT",
  "SUBMIT_REPORT",
  "INSTRUCTOR_COMMENT",
  "GRADE_ASSIGNED",
] as const;

type EventType = (typeof EVENT_TYPES)[number];

/** Events only an instructor or admin may append. */
const STAFF_ONLY_EVENTS: readonly EventType[] = ["INSTRUCTOR_COMMENT", "GRADE_ASSIGNED"];

const PHASE_KEYS = [
  "triage",
  "investigation",
  "containment",
  "eradication",
  "recovery",
  "lessons_learned",
] as const;

/** Bounded so a single payload cannot be used to bloat the audit log. */
const MAX_PAYLOAD_BYTES = 16 * 1024;

interface AppendRequest {
  session_id?: unknown;
  event_type?: unknown;
  phase?: unknown;
  payload?: unknown;
  client_meta?: unknown;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const fail = (status: number, error: string, detail?: string) => json({ error, detail }, status);

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return fail(405, "Method not allowed");

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return fail(401, "Missing Authorization header");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return fail(500, "Function is not configured");
  }

  // Identify the caller with their own token, so RLS and auth apply exactly as
  // they would anywhere else.
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await asCaller.auth.getUser();

  if (userError || !user) return fail(401, "Not signed in");

  let body: AppendRequest;
  try {
    body = (await req.json()) as AppendRequest;
  } catch {
    return fail(400, "Body must be JSON");
  }

  const sessionId = typeof body.session_id === "string" ? body.session_id : null;
  const eventType = body.event_type as EventType;
  const phase = body.phase === null || body.phase === undefined ? null : String(body.phase);
  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};

  if (!sessionId) return fail(400, "session_id is required");
  if (!EVENT_TYPES.includes(eventType)) return fail(400, `Unknown event_type: ${String(body.event_type)}`);
  if (phase !== null && !(PHASE_KEYS as readonly string[]).includes(phase)) {
    return fail(400, `Unknown phase: ${phase}`);
  }

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    return fail(413, `Payload is ${payloadBytes} bytes; the limit is ${MAX_PAYLOAD_BYTES}`);
  }

  // Service role from here: appending is exactly the operation no other role
  // is trusted with.
  const asService = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await asService
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return fail(403, "No profile for this account");

  const isStaff = profile.role === "instructor" || profile.role === "admin";

  if (STAFF_ONLY_EVENTS.includes(eventType) && !isStaff) {
    return fail(403, `${eventType} may only be recorded by an instructor`);
  }

  const { data: session } = await asService
    .from("sessions")
    .select("id, user_id, org_id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return fail(404, "Session not found");

  const ownsSession = session.user_id === user.id;
  const staffInOrg = isStaff && session.org_id === profile.org_id;

  if (!ownsSession && !staffInOrg) {
    return fail(403, "You do not have access to this session");
  }

  // A student cannot keep working a session they have already submitted; an
  // instructor can still attach comments and a grade to it.
  if (ownsSession && !staffInOrg && session.status !== "in_progress") {
    return fail(409, "This session has already been submitted");
  }

  // The status only flips once the report has been generated, which can fail
  // or lag. The SUBMIT_REPORT event is the real line: nothing the student does
  // after it may change the graded record, except the single SESSION_COMPLETE
  // the console writes straight after submitting.
  if (ownsSession && !staffInOrg) {
    const { data: closing } = await asService
      .from("session_events")
      .select("event_type")
      .eq("session_id", sessionId)
      .in("event_type", ["SUBMIT_REPORT", "SESSION_COMPLETE"]);

    const types = new Set((closing ?? []).map((row: { event_type: string }) => row.event_type));
    const allowedClose = eventType === "SESSION_COMPLETE" && !types.has("SESSION_COMPLETE");

    if (types.has("SUBMIT_REPORT") && !allowedClose) {
      return fail(409, "This session has already been submitted");
    }
  }

  // Two appends racing for the same predecessor is normal in a console that
  // logs on every interaction. The database rejects the loser; retrying with a
  // freshly read head resolves it. Beyond a few attempts something else is
  // wrong and the caller should hear about it.
  const MAX_ATTEMPTS = 4;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const { data: head, error: headError } = await asService.rpc("session_chain_head", {
      p_session_id: sessionId,
    });

    if (headError) return fail(500, "Could not read the event chain", headError.message);

    const prevHash = (head as string | null) ?? "";
    const createdAt = new Date().toISOString();

    const hash = await computeEventHash({
      prevHash,
      eventType,
      payload,
      createdAt,
    });

    const { data: inserted, error: insertError } = await asService
      .from("session_events")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        event_type: eventType,
        phase,
        payload,
        created_at: createdAt,
        prev_hash: prevHash,
        hash,
        client_meta:
          body.client_meta && typeof body.client_meta === "object" ? body.client_meta : null,
      })
      .select("id, seq, created_at, hash, prev_hash, event_type, phase")
      .single();

    if (!insertError) {
      return json({ event: inserted, attempt });
    }

    lastError = insertError.message;

    // Anything that is not the chain-head race is a real failure.
    if (!insertError.message.includes("event chain broken")) {
      return fail(400, "Could not append the event", insertError.message);
    }
  }

  return fail(
    503,
    "Could not append the event after several attempts because of concurrent writes",
    lastError,
  );
});
