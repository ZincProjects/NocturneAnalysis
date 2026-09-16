import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { getViewer } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Set password",
  robots: { index: false, follow: false },
};

/**
 * Where a password-reset link lands, and where an account created by the enrol
 * script (which has no password) can add one.
 */
export default async function SetPasswordPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/password");

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Choose a password</CardTitle>
          <CardDescription>
            Signed in as <span className="font-mono">{viewer.email}</span>. Use a password you do not
            use anywhere else.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
