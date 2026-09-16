import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
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
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", profile.org_id)
    .maybeSingle();
  if (!org) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
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
