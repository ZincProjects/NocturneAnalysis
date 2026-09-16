import { readReportModel } from "@/lib/report/generate";
import { renderReportMarkdown } from "@/lib/report/markdown";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRoleKey } from "@/lib/supabase/admin";

export const runtime = "nodejs";

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

  return new Response(renderReportMarkdown(model), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="incident-report-${model.scenario.slug}-${sessionId.slice(0, 8)}.md"`,
      "Cache-Control": "private, no-store",
    },
  });
}
