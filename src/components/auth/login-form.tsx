"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

type Mode = "password" | "signup" | "link" | "reset";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Where Supabase should send someone who clicks a link in an email.
 *
 * Built from the page's own origin rather than NEXT_PUBLIC_SITE_URL: that
 * variable is inlined at build time, and a deployment built with the
 * development value would send every confirmation email back to localhost.
 * The origin must still be on the Supabase Auth redirect allow-list.
 */
function callbackUrl(next?: string): string {
  const url = new URL("/auth/callback", window.location.origin);
  if (next && /^\/(?!\/)/.test(next)) url.searchParams.set("next", next);
  return url.toString();
}

/** Turns Supabase Auth errors into something a student can act on. */
export function explainAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email and password do not match an account. If you signed up recently, confirm your email first.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm your email address first - use the link we sent when you signed up. You can request a new one below.";
  }
  if (m.includes("signups not allowed for otp") || m.includes("user not found")) {
    return "There is no account for that email yet. Create one, or ask your instructor to enrol you.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many emails have been requested recently. Wait a few minutes and try again, or sign in with your password.";
  }
  if (m.includes("not authorized") || m.includes("error sending")) {
    return "The email could not be sent. The site's email provider is not configured to deliver to this address - ask the administrator to set up custom SMTP in Supabase.";
  }
  if (m.includes("unknown class code")) {
    return "That class code is not recognised. Check it with your instructor.";
  }
  if (m.includes("already registered")) {
    return "An account with that email already exists. Sign in instead.";
  }
  return message;
}

export function LoginForm({ next, initialError }: { next?: string; initialError?: string | null }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("password");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [handle, setHandle] = React.useState("");
  const [joinCode, setJoinCode] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initialError ?? null);
  const [sent, setSent] = React.useState<string | null>(null);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    setPending(true);
    try {
      await action();
    } catch (err) {
      setError(explainAuthError((err as Error).message));
    } finally {
      setPending(false);
    }
  }

  const signIn = () =>
    run(async () => {
      const { error: authError } = await createClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
      router.replace(next && /^\/(?!\/)/.test(next) ? next : "/dashboard");
      router.refresh();
    });

  const signUp = () =>
    run(async () => {
      if (password.length < MIN_PASSWORD_LENGTH) {
        throw new Error(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      }

      const supabase = createClient();
      const code = joinCode.trim();

      if (code) {
        const { data: orgName, error: lookupError } = await supabase.rpc("lookup_join_code", {
          p_code: code,
        });
        if (lookupError) throw lookupError;
        if (!orgName) throw new Error("Unknown class code");
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: callbackUrl(next),
          data: {
            handle: handle.trim() || undefined,
            join_code: code || undefined,
          },
        },
      });
      if (authError) throw authError;

      // With email confirmation switched off Supabase signs the user straight in.
      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      // Supabase returns a user with no identities, and sends nothing, when the
      // address is already registered - it does not reveal that as an error.
      if (data.user && data.user.identities?.length === 0) {
        throw new Error("already registered");
      }

      setSent(
        `We sent a confirmation link to ${email.trim()}. Open it on this device to activate your account, then sign in.`,
      );
    });

  const sendLink = () =>
    run(async () => {
      const { error: authError } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: callbackUrl(next),
          // Sign-in links are for existing accounts. Creating one goes through
          // the sign-up form, which collects a password and a class code.
          shouldCreateUser: false,
        },
      });
      if (authError) throw authError;
      setSent(
        `If ${email.trim()} has an account, a sign-in link is on its way. It works once and expires in an hour.`,
      );
    });

  const sendReset = () =>
    run(async () => {
      const { error: authError } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: callbackUrl("/account/password"),
      });
      if (authError) throw authError;
      setSent(
        `If ${email.trim()} has an account, a link to choose a new password is on its way.`,
      );
    });

  const resendConfirmation = () =>
    run(async () => {
      const { error: authError } = await createClient().auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: callbackUrl(next) },
      });
      if (authError) throw authError;
      setSent(`A new confirmation link is on its way to ${email.trim()}.`);
    });

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "password") void signIn();
    else if (mode === "signup") void signUp();
    else if (mode === "link") void sendLink();
    else void sendReset();
  }

  if (sent) {
    return (
      <div className="space-y-3 text-sm" role="status">
        <p className="font-medium">Check your inbox.</p>
        <p className="text-muted-foreground">{sent}</p>
        <p className="text-xs text-muted-foreground">
          Nothing after a few minutes? Check your spam folder. Emails come from Supabase Auth on
          behalf of this site.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSent(null);
            switchMode("password");
          }}
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  const needsPassword = mode === "password" || mode === "signup";
  const submitLabel = {
    password: "Sign in",
    signup: "Create account",
    link: "Email me a sign-in link",
    reset: "Email me a reset link",
  }[mode];
  const SubmitIcon = { password: KeyRound, signup: UserPlus, link: Mail, reset: Mail }[mode];

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
        {(
          [
            ["password", "Sign in"],
            ["signup", "Create account"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => switchMode(key)}
            className={
              "rounded px-3 py-1.5 text-sm font-medium transition-colors " +
              (mode === key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
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

        {needsPassword ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === "password" ? (
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => switchMode("reset")}
                >
                  Forgot password?
                </button>
              ) : null}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === "signup" ? (
              <p className="text-xs text-muted-foreground">
                At least {MIN_PASSWORD_LENGTH} characters. Do not reuse a password from another site.
              </p>
            ) : null}
          </div>
        ) : null}

        {mode === "signup" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="handle">Analyst handle (optional)</Label>
              <Input
                id="handle"
                name="handle"
                autoComplete="off"
                maxLength={25}
                pattern="[A-Za-z0-9_.\-]{3,25}"
                placeholder="night.owl"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Shown on reports and leaderboards instead of your name. Do not use your real name.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="join-code">Class code (optional)</Label>
              <Input
                id="join-code"
                name="join-code"
                autoComplete="off"
                maxLength={16}
                placeholder="From your instructor"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="font-mono uppercase placeholder:normal-case placeholder:font-sans"
              />
              <p className="text-xs text-muted-foreground">
                Without a code you join as an independent learner.
              </p>
            </div>
          </>
        ) : null}

        {error ? (
          <p id="login-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          className="w-full"
          disabled={pending || !email.trim() || (needsPassword && password.length === 0)}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <SubmitIcon className="size-4" />}
          {submitLabel}
        </Button>
      </form>

      <Separator />

      <div className="flex flex-col items-center gap-1 text-xs">
        {mode !== "link" ? (
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => switchMode("link")}>
            Email me a one-time sign-in link instead
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => switchMode("password")}>
            Sign in with a password instead
          </Button>
        )}
        {mode === "reset" ? (
          <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => switchMode("password")}>
            Back to sign in
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs"
          disabled={pending || !email.trim()}
          onClick={() => void resendConfirmation()}
        >
          Resend confirmation email
        </Button>
      </div>
    </div>
  );
}
