"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SessionReflection } from "@/lib/events/payloads";
import { REFLECTION_CONTROLS_FOR_FULL_MARKS } from "@/lib/grading/engine";

/**
 * The lessons-learned write-up.
 *
 * This is the step almost every training tool skips and the one that decides
 * whether an incident changed anything. It is mandatory, it cannot be
 * generated for the student, and it goes into the report verbatim.
 *
 * The word counter is not a hurdle for its own sake - it exists because
 * "improve security awareness" is three words and tells an IT manager nothing,
 * and students need pushing past the first platitude that comes to mind.
 */

const PROMPTS = {
  what_happened: {
    label: "What happened?",
    help: "Tell it as a story a non-technical reader could follow. Start with how the attacker got in and end with where you stopped them.",
    placeholder:
      "On the morning of..., a member of staff received an email that...",
  },
  what_worked: {
    label: "What worked?",
    help: "Which controls or decisions actually helped? Naming what went right matters: it is the argument for keeping the budget that paid for it.",
    placeholder: "The endpoint agent detected... The user reporting it early meant...",
  },
  what_to_change: {
    label: "What should change?",
    help: "Be concrete enough that somebody could raise a change ticket on Monday.",
    placeholder: "The mail gateway should quarantine rather than tag when...",
  },
} as const;

type ReflectionField = keyof typeof PROMPTS;

export function ReflectionForm({
  value,
  minWords,
  disabled,
  onChange,
}: {
  value: SessionReflection;
  minWords: number;
  disabled?: boolean;
  onChange: (next: SessionReflection) => void;
}) {
  const wordCount = React.useMemo(() => {
    const text = [value.what_happened, value.what_worked, value.what_to_change].join(" ");
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, [value]);

  const controls = value.recommended_controls;

  function setField(field: ReflectionField, next: string) {
    onChange({ ...value, [field]: next });
  }

  function setControl(index: number, next: string) {
    const updated = [...controls];
    updated[index] = next;
    onChange({ ...value, recommended_controls: updated });
  }

  const controlCount = controls.filter((c) => c.trim().length > 0).length;
  const meetsWords = wordCount >= minWords;
  const meetsControls = controlCount >= 1;
  const meetsFullMarks = controlCount >= REFLECTION_CONTROLS_FOR_FULL_MARKS;

  return (
    <div className="space-y-5">
      {(Object.keys(PROMPTS) as ReflectionField[]).map((field) => (
        <div key={field} className="space-y-1.5">
          <Label htmlFor={`reflection-${field}`}>{PROMPTS[field].label}</Label>
          <p className="text-xs text-muted-foreground">{PROMPTS[field].help}</p>
          <Textarea
            id={`reflection-${field}`}
            value={value[field]}
            disabled={disabled}
            onChange={(e) => setField(field, e.target.value)}
            placeholder={PROMPTS[field].placeholder}
            className="min-h-24"
          />
        </div>
      ))}

      <div className="space-y-2">
        <Label>Recommended controls</Label>
        <p className="text-xs text-muted-foreground">
          One specific change per line. &ldquo;Enable attachment detonation for .lnk files on the
          mail gateway&rdquo; is a recommendation; &ldquo;be more vigilant&rdquo; is a wish.
        </p>

        <ul className="space-y-2">
          {controls.map((control, index) => (
            <li key={index} className="flex gap-2">
              <Input
                value={control}
                disabled={disabled}
                onChange={(e) => setControl(index, e.target.value)}
                placeholder={`Recommendation ${index + 1}`}
                aria-label={`Recommended control ${index + 1}`}
              />
              {controls.length > 1 ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      ...value,
                      recommended_controls: controls.filter((_, i) => i !== index),
                    })
                  }
                  aria-label={`Remove recommendation ${index + 1}`}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || controls.length >= 6}
          onClick={() =>
            onChange({ ...value, recommended_controls: [...controls, ""] })
          }
        >
          <Plus className="size-3.5" />
          Add another
        </Button>
      </div>

      <div className="space-y-1 rounded-md border border-border bg-secondary/40 p-3 text-xs">
        <p className={cn("font-medium", meetsWords ? "text-chart-5" : "text-muted-foreground")}>
          {wordCount} / {minWords} words{meetsWords ? " - enough to submit" : ""}
        </p>
        <p className={cn(meetsControls ? "text-chart-5" : "text-muted-foreground")}>
          {controlCount} recommended control{controlCount === 1 ? "" : "s"} - at least one is
          required
        </p>
        <p className={cn(meetsFullMarks ? "text-chart-5" : "text-muted-foreground")}>
          {meetsFullMarks
            ? "Full marks for this section."
            : `${REFLECTION_CONTROLS_FOR_FULL_MARKS} or more earns full marks for this section.`}
        </p>
      </div>
    </div>
  );
}
