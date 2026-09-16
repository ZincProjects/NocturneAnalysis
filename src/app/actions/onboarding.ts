"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth/session";
import { QUIZ, QUIZ_PASS_MARK } from "@/lib/content/onboarding";

/**
 * Records a SOC 101 comprehension check result.
 *
 * The score is recomputed here from the submitted answers rather than trusted
 * from the client. It is a low-stakes primer quiz and nobody is being graded on
 * it - but an instructor sees the number, so it should mean what it says.
 */
export async function saveOnboardingResult(input: {
  score: number;
  maxScore: number;
  answers: Record<string, string>;
}): Promise<{ score: number; passed: boolean }> {
  const viewer = await requireViewer();
  const supabase = await createClient();

  const score = QUIZ.filter((q) => input.answers[q.key] === q.answer).length;

  const { error } = await supabase.from("onboarding_results").upsert(
    {
      user_id: viewer.userId,
      score,
      max_score: QUIZ.length,
      answers: input.answers as never,
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);

  if (score >= QUIZ_PASS_MARK && !viewer.profile.onboarding_completed_at) {
    await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", viewer.userId);
  }

  revalidatePath("/dashboard");

  return { score, passed: score >= QUIZ_PASS_MARK };
}
