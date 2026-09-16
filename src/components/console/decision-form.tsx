"use client";

import * as React from "react";
import { CheckCircle2, HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/shared/markdown";
import { cn } from "@/lib/utils";
import type { DecisionSpec } from "@/lib/content/schema";
import type { RecordedDecision } from "@/lib/session/replay";

/**
 * A recorded decision.
 *
 * Deliberately not a quiz: the form does not tell the student whether they
 * were right. It records what they decided, and the reasoning they gave, and
 * moves on - exactly like a real ticket. The model answer and its explanation
 * are revealed after the session, in the report and the review screen, where
 * they can be read against the whole incident rather than used to guess the
 * next click.
 *
 * Rationales are free text and are never machine-graded. They go to the
 * instructor, who is the only reader able to judge whether "escalated because
 * the process tree looked wrong" reflects understanding or luck.
 */
export function DecisionForm({
  spec,
  submitted,
  disabled,
  onSubmit,
}: {
  spec: DecisionSpec;
  submitted: RecordedDecision | undefined;
  disabled?: boolean;
  onSubmit: (value: string | string[], rationale: string | undefined) => void;
}) {
  const initialValue = submitted
    ? Array.isArray(submitted.decision_value)
      ? submitted.decision_value
      : [submitted.decision_value]
    : [];

  const [selected, setSelected] = React.useState<string[]>(initialValue);
  const [text, setText] = React.useState(
    spec.type === "text" && submitted ? String(submitted.decision_value) : "",
  );
  const [rationale, setRationale] = React.useState(submitted?.rationale ?? "");
  const [showHelp, setShowHelp] = React.useState(false);

  const isAnswered = Boolean(submitted);
  const rationaleRequired = spec.require_rationale;
  const rationaleOk = !rationaleRequired || rationale.trim().length >= 15;

  const hasValue = spec.type === "text" ? text.trim().length > 0 : selected.length > 0;
  const canSubmit = hasValue && rationaleOk && !disabled;

  function submit() {
    if (!canSubmit) return;
    const value: string | string[] =
      spec.type === "multi_select" ? selected : spec.type === "text" ? text.trim() : selected[0];
    onSubmit(value, rationale.trim() || undefined);
  }

  const fieldsetId = `decision-${spec.key}`;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isAnswered ? "border-chart-5/40 bg-chart-5/5" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p id={`${fieldsetId}-prompt`} className="text-sm font-medium">
          {spec.prompt}
        </p>
        {isAnswered ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-chart-5" aria-label="Recorded" />
        ) : null}
      </div>

      {spec.help_md ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={showHelp}
          >
            <HelpCircle className="size-3.5" aria-hidden />
            {showHelp ? "Hide guidance" : "What should I be weighing?"}
          </button>
          {showHelp ? (
            <div className="mt-2 rounded-md border border-border bg-secondary/40 p-3">
              <Markdown>{spec.help_md}</Markdown>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3">
        {spec.type === "select" ? (
          <RadioGroup
            value={selected[0] ?? ""}
            onValueChange={(v) => setSelected([v])}
            disabled={disabled || isAnswered}
            aria-labelledby={`${fieldsetId}-prompt`}
          >
            {spec.options.map((option) => (
              <div
                key={option.value}
                className="flex items-start gap-2.5 rounded-md border border-transparent p-2 hover:border-border"
              >
                <RadioGroupItem
                  value={option.value}
                  id={`${fieldsetId}-${option.value}`}
                  className="mt-0.5"
                />
                <Label htmlFor={`${fieldsetId}-${option.value}`} className="cursor-pointer">
                  <span className="block text-sm font-normal">{option.label}</span>
                  {option.description ? (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {option.description}
                    </span>
                  ) : null}
                </Label>
              </div>
            ))}
          </RadioGroup>
        ) : null}

        {spec.type === "multi_select" ? (
          <fieldset aria-labelledby={`${fieldsetId}-prompt`} className="space-y-1">
            {spec.options.map((option) => {
              const checked = selected.includes(option.value);
              return (
                <div
                  key={option.value}
                  className="flex items-start gap-2.5 rounded-md border border-transparent p-2 hover:border-border"
                >
                  <Checkbox
                    id={`${fieldsetId}-${option.value}`}
                    checked={checked}
                    disabled={disabled || isAnswered}
                    onCheckedChange={(next) =>
                      setSelected((prev) =>
                        next === true
                          ? [...prev, option.value]
                          : prev.filter((v) => v !== option.value),
                      )
                    }
                    className="mt-0.5"
                  />
                  <Label htmlFor={`${fieldsetId}-${option.value}`} className="cursor-pointer">
                    <span className="block text-sm font-normal">{option.label}</span>
                    {option.description ? (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </Label>
                </div>
              );
            })}
          </fieldset>
        ) : null}

        {spec.type === "text" ? (
          <Textarea
            value={text}
            disabled={disabled || isAnswered}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your answer"
            aria-labelledby={`${fieldsetId}-prompt`}
          />
        ) : null}
      </div>

      {rationaleRequired ? (
        <div className="mt-3 space-y-1.5">
          <Label htmlFor={`${fieldsetId}-rationale`} className="text-xs">
            Why? Your reasoning goes to your instructor and into your report.
          </Label>
          <Textarea
            id={`${fieldsetId}-rationale`}
            value={rationale}
            disabled={disabled || isAnswered}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="A sentence or two on what led you to this."
            className="min-h-16 text-sm"
          />
          {!isAnswered && rationale.trim().length > 0 && !rationaleOk ? (
            <p className="text-xs text-muted-foreground">
              A little more detail - at least fifteen characters.
            </p>
          ) : null}
        </div>
      ) : null}

      {!isAnswered ? (
        <Button size="sm" className="mt-3" onClick={submit} disabled={!canSubmit}>
          Record decision
        </Button>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Recorded. Decisions are final within a session - the model answer and the reasoning behind
          it are in your report.
        </p>
      )}
    </div>
  );
}
