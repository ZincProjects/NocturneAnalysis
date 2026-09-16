import { buildSampleReport } from "@/lib/content/samples";
import { renderReportMarkdown } from "@/lib/report/markdown";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const model = await buildSampleReport(slug);
  if (!model) return new Response("Not found", { status: 404 });

  return new Response(renderReportMarkdown(model), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="nocturneanalysis-sample-${slug}.md"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
