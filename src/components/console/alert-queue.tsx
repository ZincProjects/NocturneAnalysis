"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { BellRing, Check } from "lucide-react";

import { SeverityChip, type Severity } from "@/components/shared/chips";
import { cn, formatUtc } from "@/lib/utils";
import type { Alert } from "@/lib/content/schema";

/**
 * The alert queue, the thing a Tier 1 analyst actually stares at.
 *
 * Two details that carry the teaching load:
 *
 *   * Not every alert belongs to the incident. Decoys sit in the queue looking
 *     exactly as real as the rest, because deciding what to ignore is the
 *     skill being practised.
 *   * Alerts arrive over time rather than all at once. A queue that is fully
 *     populated on load reads as a quiz; one that interrupts you mid-thought
 *     reads as a shift.
 */
export function AlertQueue({
  alerts,
  selectedId,
  viewedIds,
  onSelect,
}: {
  alerts: Alert[];
  selectedId: string | null;
  viewedIds: string[];
  onSelect: (alert: Alert) => void;
}) {
  const viewed = React.useMemo(() => new Set(viewedIds), [viewedIds]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <BellRing className="size-3.5" aria-hidden />
          Alert queue
        </h2>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {alerts.length}
        </span>
      </div>

      <ul className="scrollbar-thin flex-1 overflow-y-auto" aria-label="Alert queue">
        <AnimatePresence initial={false}>
          {alerts.map((alert) => {
            const isSelected = alert.id === selectedId;
            const isViewed = viewed.has(alert.id);

            return (
              <motion.li
                key={alert.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(alert)}
                  aria-current={isSelected ? "true" : undefined}
                  className={cn(
                    "w-full border-b border-border px-3 py-2.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]",
                    isSelected ? "bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <SeverityChip severity={alert.severity as Severity} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-sm",
                          isViewed ? "text-muted-foreground" : "font-medium",
                        )}
                      >
                        {alert.title}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[0.6875rem] text-muted-foreground">
                        {alert.source}
                        {alert.host ? ` · ${alert.host}` : ""}
                      </p>
                      <p className="mt-0.5 font-mono text-[0.6875rem] text-muted-foreground">
                        {formatUtc(alert.first_seen)}
                      </p>
                    </div>
                    {isViewed ? (
                      <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-label="Viewed" />
                    ) : null}
                  </div>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
