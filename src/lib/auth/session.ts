import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/supabase/env";
import type { Tables } from "@/lib/supabase/database.types";

export type Profile = Tables<"profiles">;
export type Organization = Tables<"organizations">;

export interface Viewer {
  userId: string;
  email: string | null;
  profile: Profile;
  org: Organization;
  isStaff: boolean;
}

/**
 * The signed-in user with their profile and organization, or null.
 *
 * Wrapped in React's `cache` so that a page rendering a header, a sidebar and
 * a body all asking "who is this?" costs one round trip per request rather
 * than three.
 *
 * Returns null rather than throwing when Supabase is not configured. The site
 * header calls this on every page, and the public pages - samples, scenarios,
 * the ATT&CK and OWASP references - are built from bundled content and must
 * keep rendering for a signed-out visitor even if the database is unreachable
 * or a deployment is missing its environment variables.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Who is viewing is a per-request fact. Reading cookies first marks every
  // page that asks as dynamic, so a signed-in page is never prerendered at
  // build time - which would otherwise happen whenever credentials are absent.
  await cookies();

  if (!readSupabaseEnv()) return null;

  const supabase = await createClient();

  // getClaims verifies the session JWT locally against the project's published
  // signing keys (cached after the first request), where getUser makes a round
  // trip to the Auth server on every call. This runs on every page render, so
  // that round trip was a large share of each navigation.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  // Profile and organisation in one query rather than two.
  const { data: row } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", claims.sub)
    .maybeSingle();
  if (!row) return null;

  const { organizations: org, ...profile } = row as unknown as Profile & { organizations: Organization | null };
  if (!org) return null;

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    profile,
    org,
    isStaff: profile.role === "instructor" || profile.role === "admin",
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Not signed in");
  return viewer;
}

export async function requireStaff(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isStaff) throw new Error("Instructor or admin role required");
  return viewer;
}
