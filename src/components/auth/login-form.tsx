"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/supabase/env";

export function LoginForm({ next, initialError }: { next?: string; initialError?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mode, setMode] = React.useState<"link" | "password">("link");
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = React.useState<string | null>(initialError ?? null);

  /**
   * Password sign-in exists for demo and automated-test accounts only. Real
   * student accounts are created without one, so this path simply fails for
   * them - which is the intent. Magic links stay the route for everyone else:
   * there is no password to phish, and teaching phishing while handing out
   * passwords would be an odd look.
   */
  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("sending");

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setStatus("idle");
      setError(signInError.message);
      return;
    }

    router.replace(next && next.startsWith("/") ? next : "/dashboard");
    router.refresh();
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus("sending");

    const redirectTo = new URL("/auth/callback", siteUrl());
    if (next) redirectTo.searchParams.set("next", next);

    const { error: signInError } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirectTo.toString(),
        // Accounts are created by an instructor, not self-serve. A stranger
        // who guesses a school email address should not be able to conjure a
        // profile inside that school's organization.
        shouldCreateUser: false,
      },
    });

    if (signInError) {
      setStatus("idle");
      setError(signInError.message);
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="space-y-3 text-sm" role="status">
        <p className="font-medium">Check your inbox.</p>
        <p className="text-muted-foreground">
          If <span className="font-mono">{email}</span> belongs to an enrolled account, a sign-in
          link is on its way. It expires in an hour and works once.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setStatus("idle")}>
          Use a different address
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={mode === "password" ? signInWithPassword : onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">School email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@school.edu.example"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? "login-error" : undefined}
          aria-invalid={error ? true : undefined}
        />
      </div>

      {error ? (
        <p id="login-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {mode === "password" ? (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={
          status === "sending" ||
          !email.trim() ||
          (mode === "password" && password.length === 0)
        }
      >
        {status === "sending" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : mode === "password" ? (
          <KeyRound className="size-4" />
        ) : (
          <Mail className="size-4" />
        )}
        {mode === "password" ? "Sign in" : "Email me a sign-in link"}
      </Button>

      <Separator />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full text-xs"
        onClick={() => {
          setMode((m) => (m === "link" ? "password" : "link"));
          setError(null);
        }}
      >
        {mode === "link"
          ? "Use a password instead (demo and test accounts)"
          : "Back to sign-in links"}
      </Button>
    </form>
  );
}
