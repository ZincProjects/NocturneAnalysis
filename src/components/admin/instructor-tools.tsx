"use client";

import * as React from "react";
import { Loader2, MessageSquarePlus, Scale } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addInstructorComment, adjustGrade } from "@/app/actions/instructor";
import { PHASE_KEYS, PHASE_LABELS } from "@/lib/events/types";
import { formatUtc } from "@/lib/utils";

export interface ExistingComment {
  id: string;
  comment: string;
  phase: string | null;
  created_at: string;
  mine: boolean;
}

export function InstructorTools({
  sessionId,
  instructorHandle,
  currentScore,
  maxScore,
  adjustedScore,
  comments,
}: {
  sessionId: string;
  instructorHandle: string;
  currentScore: number | null;
  maxScore: number | null;
  adjustedScore: number | null;
  comments: ExistingComment[];
}) {
  const [comment, setComment] = React.useState("");
  const [phase, setPhase] = React.useState<string>("none");
  const [score, setScore] = React.useState(String(adjustedScore ?? currentScore ?? ""));
  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function submitComment() {
    startTransition(async () => {
      try {
        await addInstructorComment({
          sessionId,
          comment,
          phase: phase === "none" ? null : phase,
        });
        setComment("");
        setPhase("none");
        toast.success("Comment added", {
          description: "It is recorded as a new event; the student's history is unchanged.",
        });
      } catch (err) {
        toast.error("Could not add the comment", { description: (err as Error).message });
      }
    });
  }

  function submitGrade() {
    startTransition(async () => {
      try {
        await adjustGrade({ sessionId, score: Number(score), note });
        setNote("");
        toast.success("Grade recorded");
      } catch (err) {
        toast.error("Could not adjust the grade", { description: (err as Error).message });
      }
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquarePlus className="size-4 text-primary" aria-hidden />
            Feedback
          </CardTitle>
          <CardDescription>
            Comments are appended to the session&apos;s audit log as new events. Nothing already
            recorded is altered - the database will not permit it, including for you.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {comments.length > 0 ? (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatUtc(c.created_at)}</span>
                    {c.phase ? (
                      <Badge variant="secondary" className="text-[0.625rem]">
                        {PHASE_LABELS[c.phase as keyof typeof PHASE_LABELS] ?? c.phase}
                      </Badge>
                    ) : null}
                    {c.mine ? <Badge variant="outline">yours</Badge> : null}
                  </div>
                  <p className="mt-1.5 text-sm">{c.comment}</p>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="comment">Add a comment</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did they do well, and what would you want them to do differently next time?"
              className="min-h-24"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment-phase">Attach to a phase (optional)</Label>
            <Select value={phase} onValueChange={setPhase}>
              <SelectTrigger id="comment-phase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Whole session</SelectItem>
                {PHASE_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {PHASE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={submitComment} disabled={pending || comment.trim().length < 3}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Add comment as {instructorHandle}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="size-4 text-primary" aria-hidden />
            Adjust the grade
          </CardTitle>
          <CardDescription>
            The machine score comes from rules in the scenario file and does not read free text. If
            a student&apos;s reasoning deserves credit the rules cannot see, this is where you give
            it.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
            <p>
              Machine score:{" "}
              <span className="font-medium tabular-nums">
                {currentScore ?? "—"} / {maxScore ?? "—"}
              </span>
            </p>
            {adjustedScore !== null ? (
              <p className="mt-1">
                Currently adjusted to{" "}
                <span className="font-medium tabular-nums">{adjustedScore}</span>
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjusted-score">Adjusted score</Label>
            <Input
              id="adjusted-score"
              type="number"
              min={0}
              max={maxScore ?? undefined}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Whole number between 0 and {maxScore ?? "the maximum"}.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="grade-note">Reason (recorded in the log)</Label>
            <Textarea
              id="grade-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. credit for the containment rationale, which was correct even though the option chosen was not"
              className="min-h-20"
            />
          </div>

          <Button onClick={submitGrade} disabled={pending || score === ""}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Record grade
          </Button>

          <p className="text-xs text-muted-foreground">
            Recording a grade marks the session as graded. The original machine score is kept
            alongside the adjustment, so a moderator can always see both.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
