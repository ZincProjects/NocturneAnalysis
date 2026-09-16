"use client";

import { Check, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { PHASE_KEYS, PHASE_LABELS, type PhaseKey } from "@/lib/events/types";

/**
 * Phase progress. Always visible, because "where am I and what is left" is the
 * question a student loses track of first in a long exercise.
 *
 * Phases are locked in order and there is no way round it. That is the
 * lifecycle being taught: containing before you have investigated is how real
 * incidents get half-contained.
 */
export function PhaseStepper({
  currentPhase,
  completedPhases,
  className,
}: {
  currentPhase: PhaseKey;
  completedPhases: PhaseKey[];
  className?: string;
}) {
  const completed = new Set(completedPhases);
  const currentIndex = PHASE_KEYS.indexOf(currentPhase);

  return (
    <ol
      className={cn("flex items-center gap-1 overflow-x-auto", className)}
      aria-label="Incident response phases"
    >
      {PHASE_KEYS.map((phase, index) => {
        const isDone = completed.has(phase);
        const isCurrent = phase === currentPhase;
        const isLocked = index > currentIndex;

        return (
          <li key={phase} className="flex shrink-0 items-center gap-1">
            <div
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                isCurrent && "border-primary bg-primary/15 font-medium text-primary",
                isDone && !isCurrent && "border-chart-5/40 bg-chart-5/10 text-chart-5",
                isLocked && "border-border text-muted-foreground/60",
                !isCurrent && !isDone && !isLocked && "border-border text-muted-foreground",
              )}
            >
              {isDone ? (
                <Check className="size-3" aria-hidden />
              ) : isLocked ? (
                <Lock className="size-3" aria-hidden />
              ) : (
                <span className="font-mono text-[0.625rem] tabular-nums">{index + 1}</span>
              )}
              <span className="whitespace-nowrap">{PHASE_LABELS[phase]}</span>
              <span className="sr-only">
                {isDone ? " (complete)" : isCurrent ? " (current phase)" : " (locked)"}
              </span>
            </div>
            {index < PHASE_KEYS.length - 1 ? (
              <span className="h-px w-2 bg-border" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
