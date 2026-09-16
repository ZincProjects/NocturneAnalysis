import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * Landing point for every link Supabase Auth emails: sign-up confirmation,
 * sign-in links and password resets.
 *
 * Two shapes arrive here. The default email templates use the PKCE flow and
 * send `?code=`, which only works in the browser that asked for the email,
 * because the verifier lives in that browser's cookies. Templates customised
 * to `{{ .TokenHash }}` send `?token_hash=&type=`, which works on any device -
 * the better choice for students who request a link on a Chromebook and open
 * it on their phone. Both are handled.
 *
 * The `next` parameter is validated as a relative path before being used: an
 * open redirect on an auth callback is how a phishing page gets to look like it
 * came from the real login flow, which would be a particularly poor bug for
 * this product to ship.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  const fallback = type === "recovery" ? "/account/password" : "/dashboard";
  const safeNext = next && /^\/(?!\/)/.test(next) ? next : fallback;

  // Supabase redirects here with an error instead of a code when a link has
  // expired or was already used (mail scanners that pre-open links do this).
  if (searchParams.get("error")) {
    const reason = searchParams.get("error_code") === "otp_expired" ? "link_expired" : "link_invalid";
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  }

  const supabase = await createClient();

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return NextResponse.redirect(`${origin}/login?error=link_expired`);
    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // The usual cause is opening the link in a different browser from the
      // one that requested it. For a sign-up the address is confirmed by then
      // anyway, so signing in with the password works.
      return NextResponse.redirect(`${origin}/login?error=other_browser`);
    }
    return NextResponse.redirect(`${origin}${safeNext}`);
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
