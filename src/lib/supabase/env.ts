/**
 * Environment access for the Supabase clients.
 *
 * Reading these through one place means a missing variable produces a sentence
 * that says what to do, rather than "Cannot read properties of undefined"
 * somewhere deep in a request handler. That matters most for the person who
 * clones this repo to evaluate it and has not read the README yet.
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

const MISSING =
  "NocturneAnalysis needs Supabase credentials. Copy .env.example to .env.local and " +
  "fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from your " +
  "Supabase project (Dashboard > Project Settings > API), then restart the dev server.";

export function readSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (!env) throw new Error(MISSING);
  return env;
}

/** Absolute origin, used to build magic-link redirects. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  // Vercel sets this on preview deployments, where the origin is not known
  // until deploy time.
  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
