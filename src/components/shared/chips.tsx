import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MitreTechnique, OwaspCategory } from "@/lib/content/schema";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-[var(--sev-critical)]/18 text-[var(--sev-critical)] border-[var(--sev-critical)]/40",
  high: "bg-[var(--sev-high)]/18 text-[var(--sev-high)] border-[var(--sev-high)]/40",
  medium: "bg-[var(--sev-medium)]/18 text-[var(--sev-medium)] border-[var(--sev-medium)]/40",
  low: "bg-[var(--sev-low)]/18 text-[var(--sev-low)] border-[var(--sev-low)]/40",
  info: "bg-[var(--sev-info)]/18 text-[var(--sev-info)] border-[var(--sev-info)]/40",
};

/**
 * Severity is carried by colour *and* by the word, never colour alone. Roughly
 * one student in twelve cannot reliably separate the red and the amber.
 */
export function SeverityChip({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider",
        SEVERITY_STYLES[severity],
        className,
      )}
    >
      {severity}
    </span>
  );
}

export function TechniqueChip({
  technique,
  id,
  className,
}: {
  technique?: MitreTechnique | null;
  id: string;
  className?: string;
}) {
  const chip = (
    <Badge variant="outline" className={cn("font-mono text-[0.6875rem]", className)}>
      {id}
    </Badge>
  );

  if (!technique) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={`/mitre#${id}`}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {chip}
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium text-foreground">
          {technique.technique_id} - {technique.name}
        </p>
        <p className="mt-1 text-muted-foreground">{technique.tactic}</p>
        <p className="mt-1.5 line-clamp-4 text-muted-foreground">{technique.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function OwaspChip({
  category,
  code,
  className,
}: {
  category?: OwaspCategory | null;
  code: string;
  className?: string;
}) {
  const chip = (
    <Badge variant="outline" className={cn("font-mono text-[0.6875rem]", className)}>
      <ShieldAlert className="size-3" />
      {code}
    </Badge>
  );

  if (!category) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={`/owasp#${code.replace(":", "-")}`}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {chip}
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium text-foreground">{category.name}</p>
        <p className="mt-1.5 text-muted-foreground">{category.plain_language}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const DIFFICULTY_STYLES: Record<string, string> = {
  beginner: "text-chart-5",
  intermediate: "text-chart-3",
  advanced: "text-chart-4",
};

export function DifficultyChip({ difficulty }: { difficulty: string }) {
  return (
    <span className={cn("text-xs font-medium capitalize", DIFFICULTY_STYLES[difficulty])}>
      {difficulty}
    </span>
  );
}
