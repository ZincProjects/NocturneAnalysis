import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SocPrimer } from "@/components/onboarding/soc-primer";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "SOC 101",
  description:
    "A short primer on what a Security Operations Centre does, how incident response is structured, and why evidence integrity matters.",
};

export default async function OnboardingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/onboarding");

  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("onboarding_results")
    .select("score, max_score")
    .eq("user_id", viewer.userId)
    .maybeSingle();

  return <SocPrimer previousScore={previous ?? null} />;
}
