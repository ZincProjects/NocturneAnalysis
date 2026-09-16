import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  missing_code: "That sign-in link was incomplete. Request a new one below.",
  link_expired: "That sign-in link has expired or was already used. Request a new one below.",
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

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Sign in to NocturneAnalysis</CardTitle>
          <CardDescription>
            We email you a single-use link. There is no password to forget, reuse or have phished -
            which, given what this platform teaches, felt like the right default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={params.next} initialError={error} />
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        No account yet? Your instructor invites you. If you are evaluating the platform, the{" "}
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
