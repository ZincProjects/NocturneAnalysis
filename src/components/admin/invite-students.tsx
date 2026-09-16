"use client";

import * as React from "react";
import { Info, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Student enrolment.
 *
 * Enrolment is a privileged, auditable operation and is deliberately not a
 * self-service form in this release: creating accounts requires the service
 * role, and wiring that to a browser form is exactly the kind of shortcut that
 * turns one compromised instructor account into a compromised tenant.
 *
 * This screen therefore prepares the roster and hands it to the documented CLI
 * path, which is honest about what is built rather than presenting a button
 * that does not work.
 */
export function InviteStudents({ orgName }: { orgName: string }) {
  const [roster, setRoster] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const rows = roster
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  async function copyRoster() {
    try {
      await navigator.clipboard.writeText(rows.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="size-4 text-primary" aria-hidden />
          Enrol students
        </CardTitle>
        <CardDescription>
          Paste a roster, one student per line, as{" "}
          <code>email,display name,handle,cohort</code>. Students sign in with a magic link - no
          passwords are issued.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="roster">Roster for {orgName}</Label>
          <Textarea
            id="roster"
            value={roster}
            onChange={(e) => setRoster(e.target.value)}
            placeholder={"a.lim@school.edu.example,Amelia Lim,swift.kestrel,DIT-Y2-A\nj.tan@school.edu.example,Jun Tan,quiet.harbour,DIT-Y2-A"}
            className="min-h-32 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            {rows.length} {rows.length === 1 ? "student" : "students"}. Choose handles that do not
            identify the student: they appear on the leaderboard and in generated reports.
          </p>
        </div>

        <Button variant="outline" onClick={copyRoster} disabled={rows.length === 0}>
          {copied ? "Copied" : "Copy roster"}
        </Button>

        <div className="flex gap-3 rounded-md border border-border bg-secondary/40 p-3">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">How enrolment runs in this release</p>
            <p>
              Creating accounts needs the service-role credential, which stays on the server and is
              never reachable from a browser session. Enrolment therefore runs from the project
              command line:
            </p>
            <pre className="overflow-x-auto rounded border border-border bg-background p-2 font-mono">
              npm run enrol -- --org &quot;{orgName}&quot; --file roster.csv
            </pre>
            <p>
              A self-service enrolment screen backed by a scoped server action is a planned
              enhancement. It is listed here rather than mocked up because a button that silently
              does nothing is worse than an honest instruction.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
