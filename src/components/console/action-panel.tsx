"use client";

import * as React from "react";
import { AlertTriangle, Check, Loader2, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ActionSpec } from "@/lib/content/schema";

const EVENT_LABELS: Record<string, string> = {
  CONTAIN_HOST: "Endpoint",
  ISOLATE_ACCOUNT: "Identity",
  BLOCK_INDICATOR: "Network",
  ESCALATE: "Escalation",
  DOWNLOAD_ARTIFACT: "Forensics",
};

/**
 * The response actions available in the current phase.
 *
 * Every button here is a real choice with a cost. Wrong actions are offered
 * alongside right ones and are not marked - isolating the wrong host or
 * blocking the school's own CDN looks exactly as plausible as the correct
 * move until you have read the evidence.
 *
 * Destructive actions ask for typed confirmation. That is not UI ceremony: it
 * mirrors the change-control friction a real analyst meets, and it makes the
 * student read what they are about to do to somebody's working day.
 */
export function ActionPanel({
  actions,
  performedKeys,
  disabled,
  onPerform,
}: {
  actions: ActionSpec[];
  performedKeys: string[];
  disabled?: boolean;
  onPerform: (action: ActionSpec) => Promise<void>;
}) {
  const performed = React.useMemo(() => new Set(performedKeys), [performedKeys]);
  const [confirming, setConfirming] = React.useState<ActionSpec | null>(null);
  const [confirmText, setConfirmText] = React.useState("");
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  async function run(action: ActionSpec) {
    setBusyKey(action.key);
    try {
      await onPerform(action);
    } finally {
      setBusyKey(null);
      setConfirming(null);
      setConfirmText("");
    }
  }

  if (actions.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
        No response actions in this phase. The work here is analysis and judgement, recorded as
        decisions.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {actions.map((action) => {
          const done = performed.has(action.key);
          const busy = busyKey === action.key;

          return (
            <li key={action.key}>
              <div
                className={cn(
                  "rounded-lg border p-3",
                  done ? "border-chart-5/40 bg-chart-5/5" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="px-1.5 py-0 text-[0.625rem]">
                        {EVENT_LABELS[action.event_type] ?? action.event_type}
                      </Badge>
                      <p className="text-sm font-medium">{action.label}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                    <p className="mt-1 font-mono text-[0.6875rem] text-muted-foreground">
                      target: {action.target}
                    </p>
                  </div>

                  {done ? (
                    <Badge variant="success" className="shrink-0">
                      <Check className="size-3" />
                      Done
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant={action.requires_confirmation ? "destructive" : "outline"}
                      disabled={disabled || busy}
                      onClick={() =>
                        action.requires_confirmation ? setConfirming(action) : run(action)
                      }
                      className="shrink-0"
                    >
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      Execute
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(null);
            setConfirmText("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" aria-hidden />
              Confirm a high-impact action
            </DialogTitle>
            <DialogDescription>
              This action affects systems or people beyond the host you are investigating. In a real
              SOC it would need naming in the incident ticket and, often, a second pair of eyes.
            </DialogDescription>
          </DialogHeader>

          {confirming ? (
            <div className="space-y-3">
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <ShieldOff className="size-4 shrink-0 text-destructive" aria-hidden />
                  {confirming.label}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{confirming.description}</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-target">
                  Type <span className="font-mono">{confirming.target}</span> to confirm
                </Label>
                <Input
                  id="confirm-target"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                  className="font-mono text-sm"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirming(null);
                setConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!confirming || confirmText.trim() !== confirming.target || busyKey !== null}
              onClick={() => confirming && run(confirming)}
            >
              {busyKey ? <Loader2 className="size-4 animate-spin" /> : null}
              Execute action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
