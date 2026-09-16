import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ReportView } from "@/components/report/report-view";
import { readReportModel } from "@/lib/report/generate";
import { hasServiceRoleKey } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Your incident report",
  robots: { index: false, follow: false },
};

export default async function SessionReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=/console/${sessionId}/report`);

  // RLS decides access: someone else's session simply does not come back.
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) notFound();

  if (!hasServiceRoleKey()) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16">
        <h1 className="text-xl font-semibold">Report generation is not configured</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          SUPABASE_SERVICE_ROLE_KEY is missing. Grading has to run somewhere the student cannot
          influence, so the server needs it. See <code>.env.example</code>.
        </p>
      </div>
    );
  }

  const model = await readReportModel(sessionId);
  if (!model) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/dashboard">
          <ArrowLeft className="size-4" />
          Back to your dashboard
        </Link>
      </Button>

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
