"use client";

import * as React from "react";
import { ArrowRight, Check, Lightbulb, Loader2, NotebookPen, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Markdown } from "@/components/shared/markdown";
import { DecisionForm } from "@/components/console/decision-form";
import { ActionPanel } from "@/components/console/action-panel";
import { ReflectionForm } from "@/components/console/reflection-form";
import { cn } from "@/lib/utils";
import { PHASE_LABELS, PHASE_NIST_MAPPING } from "@/lib/events/types";
import type { ActionSpec, PhaseSpec } from "@/lib/content/schema";
import type { SessionReflection } from "@/lib/events/payloads";
import type { PhaseGate } from "@/lib/grading/engine";
import type { ReplayedSession } from "@/lib/session/replay";

export function CasePanel({
  phase,
  gate,
  state,
  reflection,
  isLastPhase,
  busy,
  onSubmitDecision,
  onPerformAction,
  onAddNote,
  onRequestHint,
  onAdvance,
  onReflectionChange,
  onSubmitReport,
}: {
  phase: PhaseSpec;
  gate: PhaseGate;
  state: ReplayedSession;
  reflection: SessionReflection;
  isLastPhase: boolean;
  busy: boolean;
  onSubmitDecision: (key: string, value: string | string[], rationale?: string) => void;
  onPerformAction: (action: ActionSpec) => Promise<void>;
  onAddNote: (text: string) => void;
  onRequestHint: (hintKey: string, cost: number) => void;
  onAdvance: () => void;
  onReflectionChange: (next: SessionReflection) => void;
  onSubmitReport: () => void;
}) {
  const [note, setNote] = React.useState("");

  const revealedHints = React.useMemo(
    () => new Set(state.hints.map((h) => h.hint_key)),
    [state.hints],
  );

  const phaseNotes = state.notes.filter((n) => n.phase === phase.key);
  const performedKeys = state.actions
    .filter((a) => a.phase === phase.key)
    .map((a) => a.action_key);

  const doneItems = gate.items.filter((i) => i.done).length;
  const progress = gate.items.length > 0 ? (doneItems / gate.items.length) * 100 : 0;

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="space-y-6 p-4">
        {/* ------------------------------------------------ phase header */}
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{PHASE_LABELS[phase.key]}</Badge>
            <span className="text-[0.6875rem] text-muted-foreground">
              NIST SP 800-61: {PHASE_NIST_MAPPING[phase.key]}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">{phase.title}</h2>
        </header>

        <Markdown>{phase.instructions_md}</Markdown>

        {phase.objectives.length > 0 ? (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              In this phase
            </h3>
            <ul className="mt-2 space-y-1">
              {phase.objectives.map((objective) => (
                <li key={objective} className="flex gap-2 text-xs text-muted-foreground">
                  <span aria-hidden>&middot;</span>
                  {objective}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Separator />

        {/* -------------------------------------------------- the gate */}
        <section aria-labelledby="phase-checklist-heading">
          <div className="flex items-center justify-between gap-3">
            <h3
              id="phase-checklist-heading"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Before you can move on
            </h3>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {doneItems}/{gate.items.length}
            </span>
          </div>

          <Progress value={progress} className="mt-2" aria-label="Phase completion" />

          <ul className="mt-3 space-y-2">
            {gate.items.map((item) => (
              <li key={item.label} className="flex items-start gap-2 text-xs">
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    item.done
                      ? "border-chart-5 bg-chart-5/20 text-chart-5"
                      : "border-border text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {item.done ? <Check className="size-2.5" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={item.done ? "text-muted-foreground line-through" : ""}>
                    {item.label}
                  </span>{" "}
                  <span className="font-mono tabular-nums text-muted-foreground">
                    ({item.current}/{item.required})
                  </span>
                  {item.hint && !item.done ? (
                    <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                      {item.hint}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ----------------------------------------------- decisions */}
        {phase.decisions.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Decisions
            </h3>
            {phase.decisions.map((spec) => (
              <DecisionForm
                key={spec.key}
                spec={spec}
                submitted={state.decisions.find((d) => d.decision_key === spec.key)}
                disabled={busy}
                onSubmit={(value, rationale) => onSubmitDecision(spec.key, value, rationale)}
              />
            ))}
          </section>
        ) : null}

        {/* ------------------------------------------------- actions */}
        {phase.actions.length > 0 ? (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Response actions
            </h3>
            <ActionPanel
              actions={phase.actions}
              performedKeys={performedKeys}
              disabled={busy}
              onPerform={onPerformAction}
            />
          </section>
        ) : null}

        {/* ---------------------------------------------- reflection */}
        {isLastPhase ? (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Post-incident review
            </h3>
            <ReflectionForm
              value={reflection}
              minWords={phase.success_criteria.reflection_min_words}
              disabled={busy || Boolean(state.reportSubmittedAt)}
              onChange={onReflectionChange}
            />
          </section>
        ) : null}

        {/* -------------------------------------------------- notes */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <NotebookPen className="size-3.5" aria-hidden />
            Working notes
          </h3>

          {phaseNotes.length > 0 ? (
            <ul className="space-y-1.5">
              {phaseNotes.map((n) => (
                <li
                  key={n.created_at}
                  className="rounded-md border border-border bg-secondary/40 p-2 text-xs"
                >
                  {n.text}
                </li>
              ))}
            </ul>
          ) : null}

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What are you thinking? Notes are timestamped into your report."
            className="min-h-16 text-sm"
            disabled={busy}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={busy || note.trim().length === 0}
            onClick={() => {
              onAddNote(note.trim());
              setNote("");
            }}
          >
            Save note
          </Button>
        </section>

        {/* -------------------------------------------------- hints */}
        {phase.hints.length > 0 ? (
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Lightbulb className="size-3.5" aria-hidden />
              Stuck?
            </h3>
            <ul className="space-y-2">
              {phase.hints.map((hint) => {
                const revealed = revealedHints.has(hint.key);
                return (
                  <li key={hint.key}>
                    {revealed ? (
                      <div className="rounded-md border border-chart-3/40 bg-chart-3/5 p-3">
                        <Markdown className="text-xs">{hint.text_md}</Markdown>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full justify-between"
                        disabled={busy}
                        onClick={() => onRequestHint(hint.key, hint.cost)}
                      >
                        <span className="text-xs">Reveal a hint</span>
                        <Badge variant="outline" className="text-[0.625rem]">
                          -{hint.cost} points
                        </Badge>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-[0.6875rem] text-muted-foreground">
              Hints cost points but never block you. Being stuck and asking is better practice than
              being stuck and guessing.
            </p>
          </section>
        ) : null}

        <Separator />

        {/* ------------------------------------------------- advance */}
        <div className="sticky bottom-0 -mx-4 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          {isLastPhase ? (
            <Button
              className="w-full"
              size="lg"
              disabled={busy || !gate.complete || Boolean(state.reportSubmittedAt)}
              onClick={onSubmitReport}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Submit incident report
            </Button>
          ) : (
            <Button
              className="w-full"
              size="lg"
              disabled={busy || !gate.complete}
              onClick={onAdvance}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Complete {PHASE_LABELS[phase.key]}
              <ArrowRight className="size-4" />
            </Button>
          )}

          {!gate.complete ? (
            <p className="mt-2 text-center text-[0.6875rem] text-muted-foreground">
              Finish the checklist above to continue.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
