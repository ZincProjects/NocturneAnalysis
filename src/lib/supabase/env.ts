/**
 * Environment access for the Supabase clients.
 *
 * Reading these through one place means a missing variable produces a sentence
 * that says what to do, rather than "Cannot read properties of undefined"
 * somewhere deep in a request handler. That matters most for the person who
 * clones this repo to evaluate it and has not read the README yet.
 *
 * Two deployment traps are handled here:
 *
 *  * Next.js inlines `process.env.NEXT_PUBLIC_*` into the bundle at build time.
 *    A Vercel deployment built before the variables were added keeps running
 *    without them, however many times the variables are saved afterwards. So
 *    the server also reads the variables by computed name, which is resolved
 *    at request time, and the root layout hands the two public values to the
 *    browser (see `PublicEnvScript`).
 *  * The Vercel Supabase integration names the key
 *    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`) rather than
 *    `NEXT_PUBLIC_SUPABASE_ANON_KEY`. All of these are accepted.
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

declare global {
  interface Window {
    __NOCTURNE_PUBLIC_ENV__?: Partial<SupabaseEnv>;
  }
}

const MISSING =
  "NocturneAnalysis needs Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase Dashboard > Project Settings > API) in .env.local " +
  "for development, or in the Vercel project's Environment Variables for a deployment.";

/** Reads a variable by computed name, so the bundler cannot freeze its build-time value. */
function runtimeEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const value = process.env[name];
  return value ? value : undefined;
}

export function readSupabaseEnv(): SupabaseEnv | null {
  const injected = typeof window !== "undefined" ? window.__NOCTURNE_PUBLIC_ENV__ : undefined;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    injected?.url ||
    runtimeEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    runtimeEnv("SUPABASE_URL");

  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    injected?.anonKey ||
    runtimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    runtimeEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    runtimeEnv("SUPABASE_ANON_KEY") ||
    runtimeEnv("SUPABASE_PUBLISHABLE_KEY");

  if (!url || !anonKey) return null;
  return { url: url.trim(), anonKey: anonKey.trim() };
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = readSupabaseEnv();
  if (!env) throw new Error(MISSING);
  return env;
}

/** Absolute origin, used where a request origin is not available. */
export function siteUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  const explicit = process.env.NEXT_PUBLIC_SITE_URL || runtimeEnv("NEXT_PUBLIC_SITE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  // Vercel sets this on every deployment, where the origin is not known until
  // deploy time.
  const vercel = runtimeEnv("VERCEL_URL");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
