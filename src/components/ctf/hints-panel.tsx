"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Loader2 } from "lucide-react";

import { revealHint } from "@/app/actions/ctf";
import { Markdown } from "@/components/shared/markdown";
import { Button } from "@/components/ui/button";
import type { CtfHint } from "@/lib/ctf/types";

/**
 * Hints are revealed one at a time, in order, and each costs points whether or
 * not the player goes on to solve the challenge. The cost is shown before the
 * player commits, and revealing takes a second confirming click.
 */
export function HintsPanel({
  slug,
  hints,
  canReveal,
}: {
  slug: string;
  hints: CtfHint[];
  canReveal: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (hints.length === 0) {
    return <p className="text-sm text-muted-foreground">No hints for this one.</p>;
  }

  const next = hints.find((hint) => hint.text === null);

  function reveal() {
    setError(null);
    startTransition(async () => {
      const result = await revealHint(slug);
      setConfirming(false);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        {hints.map((hint) => (
          <li key={hint.index} className="rounded-md border border-border p-3">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-medium">
                <Lightbulb className="size-3.5" aria-hidden /> Hint {hint.index + 1}
              </span>
              <span>-{hint.cost} pts</span>
            </div>
            {hint.text !== null ? (
              <Markdown className="text-sm">{hint.text}</Markdown>
            ) : (
              <p className="text-sm text-muted-foreground italic">Locked</p>
            )}
          </li>
        ))}
      </ol>

      {next && canReveal ? (
        confirming ? (
          <div className="rounded-md border border-[var(--sev-medium)]/50 bg-[var(--sev-medium)]/10 p-3 text-sm">
            <p>
              Reveal hint {next.index + 1} for <strong>{next.cost} points</strong>? The cost comes off your score
              even if you do not solve the challenge.
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={reveal} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Reveal for {next.cost} pts
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
            <Lightbulb aria-hidden /> Reveal hint {next.index + 1} (-{next.cost} pts)
          </Button>
        )
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
