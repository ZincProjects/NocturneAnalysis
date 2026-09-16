import { renderToBuffer } from "@react-pdf/renderer";

import { buildSampleReport } from "@/lib/content/samples";
import { IncidentReportDocument } from "@/lib/report/pdf";

export const runtime = "nodejs";

/**
 * Renders a sample report's PDF on demand rather than serving a stored file.
 *
 * Samples are pitch collateral that must never be stale: rendering from the
 * committed event log means the PDF cannot drift from the scenario content or
 * the grading rules the way a checked-in binary would.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const model = await buildSampleReport(slug);
  if (!model) return new Response("Not found", { status: 404 });

  const pdf = await renderToBuffer(IncidentReportDocument({ model }));

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="nocturneanalysis-sample-${slug}.pdf"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
