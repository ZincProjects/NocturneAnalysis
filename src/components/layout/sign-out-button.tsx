"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function signOut() {
    setPending(true);
    await createClient().auth.signOut();
    // Refresh so server components re-read the (now absent) session.
    router.replace("/");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon" onClick={signOut} disabled={pending} aria-label="Sign out">
      <LogOut className="size-4" />
    </Button>
  );
}
