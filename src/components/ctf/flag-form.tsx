"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Flag, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { submitFlag } from "@/app/actions/ctf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ConfettiBurst } from "./confetti";

export function FlagForm({
  slug,
  initialRetryAfter,
  closed,
}: {
  slug: string;
  initialRetryAfter: number;
  closed: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [lockedUntil, setLockedUntil] = useState(() =>
    initialRetryAfter > 0 ? Date.now() + initialRetryAfter * 1000 : 0,
  );
  const [now, setNow] = useState(() => Date.now());
  const [burst, setBurst] = useState(0);
  const [pending, startTransition] = useTransition();

  const lockSeconds = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim() || lockSeconds > 0) return;

    startTransition(async () => {
      const result = await submitFlag(slug, value);
      switch (result.result) {
        case "correct":
          setMessage(null);
          setBurst((n) => n + 1);
          toast.success(result.first_blood ? `First blood! +${result.points} points` : `Correct! +${result.points} points`, {
            description: result.first_blood ? "Nobody else has solved this one yet." : undefined,
          });
          // The solved view replaces this form, confetti and all, so let the
          // burst finish before swapping it in.
          setTimeout(() => router.refresh(), 1300);
          break;
        case "incorrect":
          setValue("");
          if (result.retry_after > 0) {
            setLockedUntil(Date.now() + result.retry_after * 1000);
            setNow(Date.now());
            setMessage({ tone: "error", text: "Incorrect. That was five wrong in a row, so this challenge is locked for a minute." });
          } else {
            setMessage({
              tone: "error",
              text: `Incorrect. ${result.attempts_left} more ${result.attempts_left === 1 ? "try" : "tries"} before a one-minute lockout.`,
            });
          }
          router.refresh();
          break;
        case "locked":
          setLockedUntil(Date.now() + result.retry_after * 1000);
          setNow(Date.now());
          setMessage({ tone: "error", text: "Too many wrong guesses. Wait for the lockout to end." });
          break;
        case "already_solved":
          setMessage({ tone: "info", text: "You have already solved this one." });
          router.refresh();
          break;
        case "closed":
          setMessage({ tone: "info", text: "Submissions are closed - the CTF is not running." });
          router.refresh();
          break;
        case "error":
          setMessage({ tone: "error", text: result.message });
          break;
      }
    });
  }

  const disabled = closed || pending || lockSeconds > 0;

  return (
    <>
      <ConfettiBurst burstKey={burst} />
      <form onSubmit={onSubmit} className="space-y-3">
        <Label htmlFor="flag-input">Submit a flag</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="flag-input"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="flag{...}"
            maxLength={200}
            autoComplete="off"
            spellCheck={false}
            disabled={closed}
            className="font-mono"
            aria-describedby="flag-feedback"
          />
          <Button type="submit" disabled={disabled || !value.trim()} className="sm:w-36">
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : lockSeconds > 0 ? (
              <Lock aria-hidden />
            ) : (
              <Flag aria-hidden />
            )}
            {lockSeconds > 0 ? `Locked ${lockSeconds}s` : "Submit"}
          </Button>
        </div>
        <p
          id="flag-feedback"
          role="status"
          aria-live="polite"
          className={message?.tone === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {closed ? "Submissions are closed." : (message?.text ?? "Flags look like flag{...}. Case does not matter.")}
        </p>
      </form>
    </>
  );
}
