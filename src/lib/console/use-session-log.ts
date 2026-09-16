"use client";

import * as React from "react";
import { toast } from "sonner";

import { logEvent, EventLogError, type AppendedEvent } from "@/lib/events/client";
import type { EventType, PhaseKey, SessionEvent } from "@/lib/events/types";
import type { PayloadFor } from "@/lib/events/payloads";
import { replaySession, type ReplayedSession } from "@/lib/session/replay";

/**
 * Console state, derived entirely by replaying the event log.
 *
 * The console does not keep a separate model of what the student has done. It
 * keeps the events, and everything on screen is `replaySession(events)`. That
 * is not a stylistic choice: the generated report is built by replaying the
 * same log server-side, so if the console tracked state independently the two
 * could disagree, and the report is the artefact a student is assessed on.
 *
 * Appends are applied optimistically - a student clicking through a phase
 * should not wait on a round trip for each click - and reconciled with the
 * server's authoritative row when it returns. A rejected append is rolled back
 * and surfaced, never swallowed.
 */

export interface SessionLog {
  state: ReplayedSession;
  events: SessionEvent[];
  append: <T extends EventType>(
    eventType: T,
    phase: PhaseKey | null,
    payload: PayloadFor<T>,
  ) => Promise<AppendedEvent | null>;
  pendingCount: number;
  lastError: string | null;
  clearError: () => void;
}

let optimisticCounter = 0;

export function useSessionLog(sessionId: string, initialEvents: SessionEvent[]): SessionLog {
  const [events, setEvents] = React.useState<SessionEvent[]>(initialEvents);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [lastError, setLastError] = React.useState<string | null>(null);

  const state = React.useMemo(() => replaySession(events), [events]);

  const append = React.useCallback(
    async <T extends EventType>(
      eventType: T,
      phase: PhaseKey | null,
      payload: PayloadFor<T>,
    ): Promise<AppendedEvent | null> => {
      optimisticCounter += 1;
      const optimisticId = `optimistic-${optimisticCounter}`;

      const optimistic: SessionEvent = {
        id: optimisticId,
        session_id: sessionId,
        user_id: null,
        event_type: eventType,
        phase,
        payload: payload as Record<string, unknown>,
        created_at: new Date().toISOString(),
        prev_hash: null,
        hash: "",
        client_meta: null,
      };

      setEvents((prev) => [...prev, optimistic]);
      setPendingCount((n) => n + 1);

      try {
        const appended = await logEvent(sessionId, eventType, phase, payload);

        // Replace the placeholder with the server's row, which carries the
        // authoritative timestamp and the hash that seals it.
        setEvents((prev) =>
          prev.map((event) =>
            event.id === optimisticId
              ? {
                  ...event,
                  id: appended.id,
                  created_at: appended.created_at,
                  hash: appended.hash,
                  prev_hash: appended.prev_hash,
                }
              : event,
          ),
        );

        return appended;
      } catch (err) {
        setEvents((prev) => prev.filter((event) => event.id !== optimisticId));

        const message =
          err instanceof EventLogError
            ? err.detail
              ? `${err.message}: ${err.detail}`
              : err.message
            : "Could not record that action.";

        setLastError(message);
        toast.error("That action was not recorded", {
          description: `${message} Your earlier work is safe - try again.`,
        });

        return null;
      } finally {
        setPendingCount((n) => Math.max(0, n - 1));
      }
    },
    [sessionId],
  );

  const clearError = React.useCallback(() => setLastError(null), []);

  return { state, events, append, pendingCount, lastError, clearError };
}
