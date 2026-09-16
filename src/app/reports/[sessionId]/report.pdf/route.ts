import { renderToBuffer } from "@react-pdf/renderer";

import { readReportModel } from "@/lib/report/generate";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRoleKey } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Downloads a session's report as PDF.
 *
 * Authorisation is checked with the caller's own Supabase client before
 * anything privileged runs: if Row Level Security will not return the session
 * row to this user, they do not get the report. The stored copy in Storage is
 * a convenience; this route renders from the event log so the download is
 * never stale relative to an instructor's later comments.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  if (!hasServiceRoleKey()) {
    return new Response("Report generation is not configured", { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return new Response("Not found", { status: 404 });

  const model = await readReportModel(sessionId);
  if (!model) return new Response("Not found", { status: 404 });

  const pdf = await renderToBuffer((await import("@/lib/report/pdf")).IncidentReportDocument({ model }));

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="incident-report-${model.scenario.slug}-${sessionId.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
