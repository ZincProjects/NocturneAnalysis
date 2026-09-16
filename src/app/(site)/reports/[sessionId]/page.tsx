import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ReportView } from "@/components/report/report-view";
import { readReportModel } from "@/lib/report/generate";
import { hasServiceRoleKey } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Incident report",
  robots: { index: false, follow: false },
};

/**
 * A single report, addressable so a student can hand the link to an instructor.
 *
 * Access is decided by Row Level Security rather than by the URL: possessing
 * the link is not authorisation. A student sees their own, staff see anything
 * in their organisation, and everyone else gets a 404.
 */
export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/reports/${sessionId}`);

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) notFound();

  if (!hasServiceRoleKey()) notFound();

  const model = await readReportModel(sessionId);
  if (!model) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <ReportView
        model={model}
        downloads={{
          pdf: `/reports/${sessionId}/report.pdf`,
          markdown: `/reports/${sessionId}/report.md`,
        }}
      />
    </div>
  );
}
