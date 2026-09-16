"use client";

import * as React from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MitreTactic, MitreTechnique } from "@/lib/content/schema";

/**
 * ATT&CK-Navigator-style coverage grid: tactics as columns, techniques as
 * cells within them.
 *
 * Two audiences, one component:
 *
 *   * `scope="library"` answers a curriculum lead's question - what does this
 *     platform actually teach, and does it fit our syllabus? That is the
 *     question that decides a purchase, and "trust us, it's comprehensive" is
 *     not an answer.
 *   * `scope="student"` answers a learner's - what have I covered, and what
 *     have I not touched yet?
 *
 * Coverage is shown by fill *and* by an explicit marker, never by colour
 * alone, and every cell is a real button so the grid is keyboard-navigable.
 */
export function AttackHeatmap({
  tactics,
  techniques,
  highlighted,
  scope,
  onSelect,
}: {
  tactics: MitreTactic[];
  techniques: MitreTechnique[];
  highlighted: string[];
  scope: "library" | "student";
  onSelect?: (technique: MitreTechnique) => void;
}) {
  const covered = React.useMemo(() => new Set(highlighted), [highlighted]);

  const byTactic = React.useMemo(() => {
    const map = new Map<string, MitreTechnique[]>();
    for (const tactic of tactics) map.set(tactic.name, []);
    for (const technique of techniques) {
      // A technique can belong to several tactics and should appear under each.
      for (const tactic of technique.tactics) {
        const bucket = map.get(tactic);
        if (bucket) bucket.push(technique);
      }
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.technique_id.localeCompare(b.technique_id));
    }
    return map;
  }, [tactics, techniques]);

  // Tactics with nothing in the curated subset would render as empty columns
  // and imply a gap that is an artefact of the subset, not of the curriculum.
  const populated = tactics.filter((t) => (byTactic.get(t.name)?.length ?? 0) > 0);

  const coveredCount = techniques.filter((t) => covered.has(t.technique_id)).length;

  return (
    // min-w-0 and max-w-full keep the grid scrolling inside its own box. Without
    // them its min-w-max row sets the minimum width of any grid or flex parent,
    // and the whole page scrolls sideways instead.
    <div className="min-w-0 max-w-full space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground tabular-nums">{coveredCount}</span> of{" "}
          <span className="tabular-nums">{techniques.length}</span> techniques{" "}
          {scope === "student" ? "exercised" : "covered by the library"}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-3 rounded-sm border border-primary/50 bg-primary/30"
            aria-hidden
          />
          {scope === "student" ? "Exercised" : "Taught"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm border border-border" aria-hidden />
          Not yet
        </span>
      </div>

      {/* `relative` matters: the sr-only labels in each cell are absolutely
          positioned, and without a positioned scroller they escape its clipping
          and stretch the whole page sideways. */}
      <div className="scrollbar-thin relative overflow-x-auto pb-2">
        <div className="flex min-w-max gap-1.5">
          {populated.map((tactic) => {
            const bucket = byTactic.get(tactic.name) ?? [];
            const bucketCovered = bucket.filter((t) => covered.has(t.technique_id)).length;

            return (
              <div key={tactic.shortname} className="w-36 shrink-0">
                <div className="mb-1.5 border-b border-border pb-1">
                  <p className="text-[0.6875rem] font-semibold leading-tight">{tactic.name}</p>
                  <p className="font-mono text-[0.625rem] tabular-nums text-muted-foreground">
                    {bucketCovered}/{bucket.length}
                  </p>
                </div>

                <ul className="space-y-1">
                  {bucket.map((technique) => {
                    const isCovered = covered.has(technique.technique_id);
                    return (
                      <li key={`${tactic.shortname}-${technique.technique_id}`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => onSelect?.(technique)}
                              aria-pressed={isCovered}
                              className={cn(
                                "w-full rounded-sm border px-1.5 py-1 text-left transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                                isCovered
                                  ? "border-primary/50 bg-primary/25 text-foreground"
                                  : "border-border text-muted-foreground hover:bg-accent",
                              )}
                            >
                              <span className="block font-mono text-[0.625rem] tabular-nums">
                                {technique.technique_id}
                                {isCovered ? (
                                  <span aria-hidden> &bull;</span>
                                ) : null}
                              </span>
                              <span className="block truncate text-[0.625rem] leading-tight">
                                {technique.name}
                              </span>
                              <span className="sr-only">
                                {isCovered ? " - covered" : " - not covered"}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium text-foreground">
                              {technique.technique_id} - {technique.name}
                            </p>
                            <p className="mt-1 text-muted-foreground">
                              {technique.tactics.join(", ")}
                            </p>
                            <p className="mt-1.5 line-clamp-5 text-muted-foreground">
                              {technique.description}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
