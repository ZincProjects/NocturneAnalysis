import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { generateReportForSession } from "@/lib/report/generate";
import { hasServiceRoleKey } from "@/lib/supabase/admin";

/**
 * Finalises a submitted session and produces its report.
 *
 * The request carries a session id and nothing else that matters. Everything
 * in the report - the score, the timeline, which indicators were found - is
 * recomputed from the session's event log, so a student who edits this request
 * changes nothing except which session they are asking about, and they can
 * only ask about their own.
 *
 * PDF rendering is why this runs on the Node runtime rather than the Edge one.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      {
        error: "Report generation is not configured",
        detail:
          "SUPABASE_SERVICE_ROLE_KEY is missing. See .env.example - it is required for grading, " +
          "which must happen somewhere the student cannot influence.",
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { session_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const sessionId = typeof body.session_id === "string" ? body.session_id : null;
  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  // Read through the caller's own client so RLS decides whether they may see
  // this session at all, before anything privileged happens.
  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id, org_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id")
    .eq("id", user.id)
    .maybeSingle();

  const isStaff = profile?.role === "instructor" || profile?.role === "admin";
  const owns = session.user_id === user.id;

  if (!owns && !(isStaff && profile?.org_id === session.org_id)) {
    return NextResponse.json({ error: "You do not have access to this session" }, { status: 403 });
  }

  try {
    const result = await generateReportForSession(sessionId);
    return NextResponse.json({
      session_id: sessionId,
      score: result.score,
      max_score: result.maxScore,
      pdf_stored: result.pdfPath !== null,
      chain_valid: result.model.integrity.valid,
    });
  } catch (err) {
    const message = (err as Error).message;
    // "Not submitted yet" is the caller's mistake, not a server fault.
    const status = message.includes("not been submitted") ? 409 : 500;
    return NextResponse.json({ error: "Could not generate the report", detail: message }, { status });
  }
}
