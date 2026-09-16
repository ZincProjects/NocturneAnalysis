"use client";

import * as React from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { startSession } from "@/app/actions/session";

export function StartSessionButton({ slug }: { slug: string }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm text-muted-foreground">
          The clock starts when you enter the console, and every action from that point is recorded.
          You can leave and come back - the incident will be where you left it.
        </p>
        <Button
          className="w-full"
          size="lg"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await startSession(slug);
              } catch (err) {
                // A redirect throws by design; only surface real failures.
                if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
                toast.error("Could not start the session", {
                  description: (err as Error).message,
                });
              }
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Enter the SOC console
        </Button>
      </CardContent>
    </Card>
  );
}
