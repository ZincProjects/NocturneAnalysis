import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { readSupabaseEnv } from "./env";

/**
 * Service-role client. Bypasses Row Level Security entirely.
 *
 * Used for exactly one thing in the running application: finalising a session
 * after the student submits. Grading has to be computed somewhere the student
 * cannot influence, and the resulting score and report have to be written to
 * tables no student may write to - otherwise a student could simply POST
 * themselves full marks.
 *
 * Rules for using this:
 *   * Never import it into a client component. The `server-only` guard above
 *     turns that into a build error rather than a leaked key.
 *   * Always establish who the caller is with the normal request-scoped client
 *     first, and re-check they own the row. This client will happily do
 *     anything it is asked.
 *   * Never let a value from the request body decide what gets written. The
 *     score comes from replaying the event log, not from the browser.
 *
 * Note that this is not needed for appending events: that path goes through
 * the append-event Edge Function, where Supabase injects the key itself and it
 * never touches the web server.
 */

const MISSING =
  "SUPABASE_SERVICE_ROLE_KEY is not set. Report generation needs it to write a score the " +
  "student cannot forge. Copy it from Dashboard > Project Settings > API into .env.local, and " +
  "set it in the Vercel project settings. Never prefix it with NEXT_PUBLIC_ and never commit it.";

export function createAdminClient() {
  const url = readSupabaseEnv()?.url;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) throw new Error(MISSING);

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
