"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { requireSupabaseEnv } from "./env";

/**
 * Browser client. Safe to hold the publishable key here: every table is behind
 * Row Level Security, so this key grants a visitor exactly what an anonymous
 * visitor is meant to have and nothing more.
 *
 * Note what this client cannot do: it has no INSERT grant on `session_events`.
 * Appending to the audit log goes through `/api/events`, which forwards to the
 * append-event Edge Function. That is deliberate - if the browser could write
 * events it could also choose their hashes, and the chain would prove nothing.
 */
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (browserClient) return browserClient;
  const { url, anonKey } = requireSupabaseEnv();
  browserClient = createBrowserClient<Database>(url, anonKey);
  return browserClient;
}
