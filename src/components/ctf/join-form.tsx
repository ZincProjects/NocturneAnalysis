"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { joinCtf, type JoinState } from "@/app/actions/ctf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JoinForm({ requiresPasscode }: { requiresPasscode: boolean }) {
  const [state, action, pending] = useActionState<JoinState, FormData>(joinCtf, { error: null });

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ctf-handle">Handle</Label>
        <Input
          id="ctf-handle"
          name="handle"
          required
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9][A-Za-z0-9_.\-]{2,23}"
          autoComplete="off"
          spellCheck={false}
          placeholder="e.g. packet.pirate"
          aria-describedby="ctf-handle-help"
        />
        <p id="ctf-handle-help" className="text-xs text-muted-foreground">
          Shown on the scoreboard. Use a nickname, not your real name.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ctf-team">
          Team <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input id="ctf-team" name="team" maxLength={32} autoComplete="off" placeholder="e.g. Blue Team 3" />
      </div>

      {requiresPasscode ? (
        <div className="space-y-1.5">
          <Label htmlFor="ctf-passcode">Event passcode</Label>
          <Input
            id="ctf-passcode"
            name="passcode"
            required
            autoComplete="off"
            spellCheck={false}
            aria-describedby="ctf-passcode-help"
          />
          <p id="ctf-passcode-help" className="text-xs text-muted-foreground">
            Your organiser will give you this.
          </p>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Join the CTF
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        No email or password. This browser keeps your place for 30 days.
      </p>
    </form>
  );
}
