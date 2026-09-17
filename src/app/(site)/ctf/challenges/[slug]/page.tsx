import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, Droplet } from "lucide-react";

import { FlagForm } from "@/components/ctf/flag-form";
import { HintsPanel } from "@/components/ctf/hints-panel";
import { Markdown } from "@/components/shared/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getChallengeDetail } from "@/lib/ctf/server";

export const metadata: Metadata = { title: "CTF challenge" };

export default async function CtfChallengePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { detail, code } = await getChallengeDetail(slug);

  if (code === "no_player") redirect("/ctf");
  if (code === "not_live") redirect("/ctf/challenges");
  if (!detail) notFound();

  const live = detail.event.status === "live";
  const fileName = detail.file_path?.split("/").pop();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/ctf/challenges">
          <ArrowLeft aria-hidden /> All challenges
        </Link>
      </Button>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary" className="capitalize">
                  {detail.category}
                </Badge>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Droplet className="size-3" aria-hidden />
                  {detail.solve_count} {detail.solve_count === 1 ? "solve" : "solves"}
                </span>
                {detail.solved ? (
                  <Badge variant="success">
                    <CheckCircle2 className="size-3" aria-hidden /> Solved
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">{detail.title}</h1>
                <span className="font-mono text-2xl font-semibold text-primary">
                  {detail.points}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">pts</span>
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <Markdown className="text-base [&_p]:text-foreground/90">{detail.prompt_md}</Markdown>

              {detail.file_path ? (
                <Button asChild variant="outline">
                  <a href={detail.file_path} download>
                    <Download aria-hidden /> Download {fileName}
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              {detail.solved ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-chart-5" aria-hidden />
                  <div>
                    <p className="font-medium">Solved - {detail.points} points banked.</p>
                    <p className="text-sm text-muted-foreground">
                      Took {detail.attempts} {detail.attempts === 1 ? "attempt" : "attempts"}.{" "}
                      <Link href="/ctf/challenges" className="underline underline-offset-2">
                        Pick your next challenge
                      </Link>
                      .
                    </p>
                  </div>
                </div>
              ) : (
                <FlagForm slug={detail.slug} initialRetryAfter={detail.retry_after} closed={!live} />
              )}
              {!detail.solved && detail.attempts > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {detail.attempts} wrong {detail.attempts === 1 ? "attempt" : "attempts"} so far.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {detail.explanation_md ? (
            <Card className="border-primary/40">
              <CardHeader>
                <CardTitle>What you just learned</CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown>{detail.explanation_md}</Markdown>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hints</CardTitle>
              <CardDescription>Each hint costs points. Try on your own first.</CardDescription>
            </CardHeader>
            <CardContent>
              <HintsPanel slug={detail.slug} hints={detail.hints} canReveal={live && !detail.solved} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
