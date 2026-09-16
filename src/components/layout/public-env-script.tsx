import { readSupabaseEnv } from "@/lib/supabase/env";

/**
 * Hands the Supabase URL and publishable key to the browser at request time.
 *
 * Both values are public by design - every table is behind Row Level Security -
 * so exposing them is safe. The service-role key is never read here. This exists
 * so a deployment whose variables were added after it was built still works in
 * the browser; see `src/lib/supabase/env.ts`.
 */
export function PublicEnvScript() {
  const env = readSupabaseEnv();
  if (!env) return null;

  const json = JSON.stringify({ url: env.url, anonKey: env.anonKey }).replace(/</g, "\u003c");

  return (
    <script
      id="nocturne-public-env"
      dangerouslySetInnerHTML={{ __html: `window.__NOCTURNE_PUBLIC_ENV__=${json};` }}
    />
  );
}
