"use client";

import type { EventType, PhaseKey } from "./types";
import type { PayloadFor } from "./payloads";

/**
 * The single client-side entry point for the audit log.
 *
 * Nothing in the console writes an event any other way. That is what makes
 * "every meaningful action is recorded" a property of the system rather than a
 * promise about developer discipline - there is one function, and reviewing
 * whether an interaction is logged means checking whether it calls this.
 *
 * Delivery guarantees, and their limits:
 *
 *   * Appends are serialised through a promise chain. The chain is ordered, so
 *     two clicks in quick succession cannot race each other into the wrong
 *     order, and the Edge Function's chain-head retry is a backstop rather
 *     than the normal path.
 *   * A failed append is retried with backoff. A student on school wifi should
 *     not lose their triage decision to one dropped packet.
 *   * If it still fails, the caller is told. The console surfaces this rather
 *     than silently continuing, because an action the student believes was
 *     recorded and was not is worse than an error message.
 */

export interface LogEventOptions {
  /** Await the append instead of firing and forgetting. */
  await_persist?: boolean;
  /** Retry attempts on network failure. Rejections from the server are final. */
  retries?: number;
}

export interface AppendedEvent {
  id: string;
  seq: number;
  created_at: string;
  hash: string;
  prev_hash: string;
  event_type: EventType;
  phase: PhaseKey | null;
}

export class EventLogError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "EventLogError";
    this.status = status;
    this.detail = detail;
  }
}

/** Appends are chained so their order matches the order the student acted. */
let queue: Promise<unknown> = Promise.resolve();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function clientMeta(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  return {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    // Recorded so an instructor reviewing a session can see whether the
    // student was on a phone, a Chromebook or a lab desktop. Not used for
    // anything else, and never used to identify a device across sessions.
    user_agent: navigator.userAgent.slice(0, 180),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

async function postEvent(
  sessionId: string,
  eventType: EventType,
  phase: PhaseKey | null,
  payload: unknown,
  retries: number,
): Promise<AppendedEvent> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await sleep(250 * 2 ** (attempt - 1));

    let response: Response;
    try {
      response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          event_type: eventType,
          phase,
          payload,
          client_meta: clientMeta(),
        }),
      });
    } catch (err) {
      lastError = err as Error;
      continue; // Network-level failure: worth retrying.
    }

    if (response.ok) {
      const data = (await response.json()) as { event: AppendedEvent };
      return data.event;
    }

    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
    };

    // 5xx may be transient; anything else is a considered refusal and retrying
    // it would just produce the same answer more slowly.
    if (response.status < 500) {
      throw new EventLogError(body.error ?? "The event was rejected", response.status, body.detail);
    }

    lastError = new EventLogError(
      body.error ?? "The event service is unavailable",
      response.status,
      body.detail,
    );
  }

  throw lastError ?? new EventLogError("Could not record the event", 0);
}

export function logEvent<T extends EventType>(
  sessionId: string,
  eventType: T,
  phase: PhaseKey | null,
  payload: PayloadFor<T>,
  options: LogEventOptions = {},
): Promise<AppendedEvent> {
  const { retries = 2 } = options;

  const run = queue.then(
    () => postEvent(sessionId, eventType, phase, payload, retries),
    () => postEvent(sessionId, eventType, phase, payload, retries),
  );

  // Keep the chain alive even when one append fails, so a single error does
  // not wedge every later event behind a rejected promise.
  queue = run.catch(() => undefined);

  return run;
}
