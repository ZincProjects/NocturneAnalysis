import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link landing point.
 *
 * Supabase sends the user here with a one-time code, which is exchanged for a
 * session and set as httpOnly cookies. The `next` parameter is validated as a
 * relative path before being used: an open redirect on an auth callback is how
 * a phishing page gets to look like it came from the real login flow, which
 * would be a particularly poor bug for this product to ship.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const safeNext = next && /^\/(?!\/)/.test(next) ? next : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
