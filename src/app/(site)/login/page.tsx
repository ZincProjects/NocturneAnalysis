import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { getViewer } from "@/lib/auth/session";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  missing_code: "That link was incomplete. Request a new one below.",
  link_expired: "That link has expired or was already used. Request a new one below.",
  link_invalid: "That link is not valid any more. Request a new one below.",
  other_browser:
    "That link has to be opened in the same browser you requested it from. If you were confirming a new account it is now confirmed - sign in with your password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const viewer = await getViewer();
  if (viewer) redirect("/dashboard");

  const params = await searchParams;
  const error = params.error ? (ERRORS[params.error] ?? "Sign-in failed. Try again below.") : null;

  if (!readSupabaseEnv()) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sign-in is not configured</CardTitle>
            <CardDescription>
              This deployment cannot see its Supabase credentials. In Vercel, open Project
              Settings, then Environment Variables, and add NEXT_PUBLIC_SUPABASE_URL and
              NEXT_PUBLIC_SUPABASE_ANON_KEY for the Production environment. Then redeploy.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Signed in to Supabase but with no profile: the account exists, but nothing
  // placed it in an organisation. Without this branch the dashboard sends them
  // here, and this page shows a sign-in form to someone already signed in.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Your account is not set up yet</CardTitle>
            <CardDescription>
              You are signed in as <span className="font-mono">{user.email}</span>, but this account
              is not enrolled in an organisation. Ask your instructor to enrol you, or sign out and
              create an account with their class code.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
            <SignOutButton /> Sign out
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign in to NocturneAnalysis</CardTitle>
          <CardDescription>
            Sign in with your password, create an account, or have a one-time link emailed to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={params.next} initialError={error} />
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Evaluating the platform? The{" "}
        <Link href="/samples" className="text-primary underline underline-offset-2">
          sample reports
        </Link>{" "}
        and the{" "}
        <Link href="/scenarios" className="text-primary underline underline-offset-2">
          scenario library
        </Link>{" "}
        need no sign-in.
      </p>
    </div>
  );
}
