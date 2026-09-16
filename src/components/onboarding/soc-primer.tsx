"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, GraduationCap, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Markdown } from "@/components/shared/markdown";
import { cn } from "@/lib/utils";
import { PRIMER_SECTIONS, QUIZ, QUIZ_PASS_MARK } from "@/lib/content/onboarding";
import { saveOnboardingResult } from "@/app/actions/onboarding";

/**
 * The SOC 101 walkthrough.
 *
 * A stepper rather than one long page, because the point is to replace a wall
 * of text, and because reaching the end of a five-step sequence is a much
 * better completion signal than scrolling.
 *
 * The comprehension check shows its explanation whichever way the student
 * answered. Telling somebody they were right without saying why leaves them
 * right by accident.
 */
export function SocPrimer({
  previousScore,
}: {
  previousScore: { score: number; max_score: number } | null;
}) {
  const router = useRouter();
  const totalSteps = PRIMER_SECTIONS.length + 1;

  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [revealed, setRevealed] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const isQuiz = step === PRIMER_SECTIONS.length;
  const section = PRIMER_SECTIONS[step];

  const answeredCount = QUIZ.filter((q) => answers[q.key]).length;
  const score = QUIZ.filter((q) => answers[q.key] === q.answer).length;

  function goTo(next: number) {
    setStep(Math.max(0, Math.min(totalSteps - 1, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitQuiz() {
    setRevealed(true);
    setSaving(true);
    try {
      await saveOnboardingResult({ score, maxScore: QUIZ.length, answers });
      toast.success(`${score} out of ${QUIZ.length}`, {
        description:
          score >= QUIZ_PASS_MARK
            ? "Recorded. The SOC 101 Graduate badge is on your dashboard."
            : "Recorded. Read back through the sections you are unsure about and try again.",
      });
      router.refresh();
    } catch (err) {
      toast.error("Could not save your result", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" aria-hidden />
            <h1 className="text-2xl font-semibold tracking-tight">SOC 101</h1>
          </div>
          {previousScore ? (
            <Badge variant="secondary">
              Previous result: {previousScore.score}/{previousScore.max_score}
            </Badge>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Fifteen minutes on what a SOC does, how incident response is structured, and why this
          platform hashes everything you do. Worth reading before your first scenario, and you can
          skip it if you would rather dive in.
        </p>

        <div className="mt-4">
          <Progress
            value={((step + 1) / totalSteps) * 100}
            aria-label={`Step ${step + 1} of ${totalSteps}`}
          />
          <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="Primer sections">
            {PRIMER_SECTIONS.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => goTo(i)}
                aria-current={step === i ? "step" : undefined}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  step === i
                    ? "border-primary bg-primary/15 text-primary"
                    : step > i
                      ? "border-chart-5/40 text-chart-5"
                      : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                {step > i ? <Check className="mr-1 inline size-3" aria-hidden /> : null}
                {s.title}
              </button>
            ))}
            <button
              type="button"
              onClick={() => goTo(PRIMER_SECTIONS.length)}
              aria-current={isQuiz ? "step" : undefined}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                isQuiz
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              Comprehension check
            </button>
          </nav>
        </div>
      </header>

      {!isQuiz && section ? (
        <Card>
          <CardHeader>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Section {step + 1} of {PRIMER_SECTIONS.length}
            </p>
            <CardTitle className="text-xl">{section.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{section.lede}</p>
          </CardHeader>
          <CardContent>
            <Markdown className="text-[0.9375rem]">{section.body_md}</Markdown>
          </CardContent>
        </Card>
      ) : null}

      {isQuiz ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Comprehension check</CardTitle>
            <p className="text-sm text-muted-foreground">
              Five questions. Not a gate - you can start a scenario either way - but{" "}
              {QUIZ_PASS_MARK} or more earns the SOC 101 Graduate badge, and your instructor sees
              the result.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {QUIZ.map((question, index) => {
              const given = answers[question.key];
              const correct = given === question.answer;

              return (
                <fieldset key={question.key} className="space-y-3">
                  <legend className="text-sm font-medium">
                    {index + 1}. {question.prompt}
                  </legend>

                  <RadioGroup
                    value={given ?? ""}
                    onValueChange={(value) =>
                      setAnswers((prev) => ({ ...prev, [question.key]: value }))
                    }
                    disabled={revealed}
                  >
                    {question.options.map((option) => (
                      <div
                        key={option.value}
                        className={cn(
                          "flex items-start gap-2.5 rounded-md border p-2.5",
                          revealed && option.value === question.answer
                            ? "border-chart-5/50 bg-chart-5/5"
                            : revealed && option.value === given
                              ? "border-destructive/50 bg-destructive/5"
                              : "border-transparent hover:border-border",
                        )}
                      >
                        <RadioGroupItem
                          value={option.value}
                          id={`${question.key}-${option.value}`}
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor={`${question.key}-${option.value}`}
                          className="cursor-pointer text-sm font-normal"
                        >
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>

                  {revealed ? (
                    <div
                      className={cn(
                        "rounded-md border p-3",
                        correct ? "border-chart-5/40 bg-chart-5/5" : "border-border bg-secondary/40",
                      )}
                    >
                      <p className="text-xs font-medium">
                        {correct ? "Correct." : "Not quite."}
                      </p>
                      <Markdown className="mt-1.5 text-xs">{question.explanation_md}</Markdown>
                    </div>
                  ) : null}
                </fieldset>
              );
            })}

            {revealed ? (
              <div className="rounded-lg border border-border bg-secondary/40 p-4">
                <p className="text-lg font-semibold">
                  {score} out of {QUIZ.length}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {score >= QUIZ_PASS_MARK
                    ? "That is a pass. The badge is on your dashboard, and you are ready for the first scenario."
                    : "Worth reading back through the sections covering the ones you missed before starting a scenario."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/scenarios/phishing-initial-access/briefing">
                      Start the first scenario
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAnswers({});
                      setRevealed(false);
                      goTo(0);
                    }}
                  >
                    <RotateCcw className="size-4" />
                    Go through it again
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                className="w-full"
                size="lg"
                disabled={answeredCount < QUIZ.length || saving}
                onClick={submitQuiz}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                {answeredCount < QUIZ.length
                  ? `Answer all ${QUIZ.length} questions (${answeredCount} done)`
                  : "Check my answers"}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 0}>
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {isQuiz ? (
          <Button variant="ghost" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        ) : (
          <Button onClick={() => goTo(step + 1)}>
            {step === PRIMER_SECTIONS.length - 1 ? "Comprehension check" : "Next"}
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        In a hurry?{" "}
        <Link
          href="/scenarios"
          className="text-primary underline underline-offset-2"
        >
          Skip to the scenario library
        </Link>{" "}
        &mdash; you can come back to this at any point.
      </p>
    </div>
  );
}
