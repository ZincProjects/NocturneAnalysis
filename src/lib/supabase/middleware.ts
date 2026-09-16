import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./database.types";
import { readSupabaseEnv } from "./env";

/** Routes a signed-out visitor may reach. Everything else redirects to /login. */
const PUBLIC_PREFIXES = [
  "/",
  "/for-schools",
  "/login",
  "/auth",
  "/scenarios",
  "/samples",
  "/reports",
  "/mitre",
  "/owasp",
  "/legal",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Refreshes the Supabase session on every request and gates private routes.
 *
 * The cookie dance below is prescribed by @supabase/ssr: the response object
 * must be rebuilt whenever cookies are set, or a refreshed token never reaches
 * the browser and the user is silently signed out mid-session.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const env = readSupabaseEnv();
  if (!env) {
    // Without credentials there is no session to refresh. The pages themselves
    // surface a clear setup message rather than failing here.
    return response;
  }

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims() refreshes an expired session and verifies the JWT signature
  // against the project's signing keys, without the Auth-server round trip
  // getUser() makes on every request. getSession() alone would only decode the
  // cookie, which a client could have tampered with.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  return response;
}
