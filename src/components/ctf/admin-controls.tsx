"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  adminSignIn,
  removePlayer,
  resetPlayer,
  setChallengeActive,
  updateEvent,
  type AdminFormState,
} from "@/app/actions/ctf-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminSignInForm() {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(adminSignIn, { error: null });
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="ctf-admin-passcode">Organiser passcode</Label>
        <Input id="ctf-admin-passcode" name="passcode" type="password" required autoComplete="current-password" />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Open organiser screen
      </Button>
    </form>
  );
}

/** datetime-local wants local wall-clock time with no zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventForm({
  title,
  startsAt,
  endsAt,
  isActive,
  hasPasscode,
}: {
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  hasPasscode: boolean;
}) {
  const [state, action, pending] = useActionState<AdminFormState, FormData>(updateEvent, { error: null });
  const [mode, setMode] = useState<"keep" | "set" | "clear">("keep");
  const [start, setStart] = useState(() => toLocalInput(startsAt));
  const [end, setEnd] = useState(() => toLocalInput(endsAt));

  // The server has no idea which time zone the organiser is in, so send
  // absolute instants rather than the wall-clock strings the inputs hold.
  const iso = (local: string) => (local ? new Date(local).toISOString() : "");

  function startNow(hours: number) {
    const now = new Date();
    setStart(toLocalInput(now.toISOString()));
    setEnd(toLocalInput(new Date(now.getTime() + hours * 3600_000).toISOString()));
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="starts_at" value={iso(start)} />
      <input type="hidden" name="ends_at" value={iso(end)} />
      <input type="hidden" name="passcode_mode" value={mode} />

      <div className="space-y-1.5">
        <Label htmlFor="event-title">Title</Label>
        <Input id="event-title" name="title" defaultValue={title} maxLength={80} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="event-start">Starts</Label>
          <Input id="event-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-end">Ends</Label>
          <Input id="event-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">Quick set:</span>
        {[1, 1.5, 2].map((hours) => (
          <Button key={hours} type="button" variant="outline" size="sm" onClick={() => startNow(hours)}>
            Start now, {hours} h
          </Button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={isActive} className="size-4 accent-[var(--primary)]" />
        Event active (untick to pause the whole CTF)
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Join passcode</legend>
        <p className="text-xs text-muted-foreground">
          {hasPasscode ? "A passcode is set. Players need it to join." : "No passcode. Anyone with the link can join."}
          {" "}Only a hash is stored, so the current one cannot be shown.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          {(
            [
              ["keep", "Keep as is"],
              ["set", hasPasscode ? "Change" : "Set one"],
              ...(hasPasscode ? [["clear", "Remove"] as const] : []),
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="passcode_mode_choice"
                checked={mode === value}
                onChange={() => setMode(value)}
                className="accent-[var(--primary)]"
              />
              {label}
            </label>
          ))}
        </div>
        {mode === "set" ? (
          <Input name="passcode" required minLength={4} maxLength={64} autoComplete="off" placeholder="New passcode" />
        ) : null}
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : state.ok ? (
        <p role="status" className="text-sm text-chart-5">
          {state.ok}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Save event
      </Button>
    </form>
  );
}

export function ChallengeToggle({ slug, active, title }: { slug: string; active: boolean; title: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={active ? "outline" : "secondary"}
      disabled={pending}
      aria-label={`${active ? "Switch off" : "Switch on"} ${title}`}
      onClick={() =>
        startTransition(async () => {
          try {
            await setChallengeActive(slug, !active);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not update the challenge");
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {active ? "On" : "Off"}
    </Button>
  );
}

export function PlayerActions({ playerId, handle }: { playerId: string; handle: string }) {
  const [pending, startTransition] = useTransition();

  function run(label: string, confirmText: string, fn: () => Promise<void>) {
    if (!window.confirm(confirmText)) return;
    startTransition(async () => {
      try {
        await fn();
        toast.success(label);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          run(
            `Reset ${handle}`,
            `Reset ${handle}'s score? Their solves and hint reveals are deleted. The handle stays.`,
            () => resetPlayer(playerId),
          )
        }
      >
        Reset score
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive"
        disabled={pending}
        onClick={() =>
          run(
            `Removed ${handle}`,
            `Remove ${handle} completely? Their browser is signed out and the handle is freed.`,
            () => removePlayer(playerId),
          )
        }
      >
        Remove
      </Button>
    </div>
  );
}
