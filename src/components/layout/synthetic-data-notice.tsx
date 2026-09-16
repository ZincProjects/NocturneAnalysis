import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The claim this whole product rests on when an IT department reviews it.
 *
 * It is shown persistently rather than tucked into a policy page, and it is
 * not marketing: `npm run content:validate` mechanically re-checks every
 * address and hostname in the scenario library against the IETF reserved
 * ranges, and the build fails if anything could resolve.
 */
export function SyntheticDataNotice({
  variant = "bar",
  className,
}: {
  variant?: "bar" | "card";
  className?: string;
}) {
  if (variant === "card") {
    return (
      <div
        className={cn(
          "flex gap-3 rounded-lg border border-chart-5/30 bg-chart-5/5 p-4 text-sm",
          className,
        )}
      >
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-chart-5" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium">This platform uses 100% synthetic data.</p>
          <p className="text-muted-foreground">
            No real attacks, scans or external targets. Every alert, log line, email and indicator is
            generated content stored in this application&apos;s own database. Addresses come from the
            IETF documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) and domains use
            reserved TLDs, so nothing here resolves or routes anywhere. Nothing in NocturneAnalysis
            sends traffic to any third party.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 border-b border-border bg-secondary/50 px-4 py-1.5 text-center text-xs text-muted-foreground",
        className,
      )}
    >
      <ShieldCheck className="size-3.5 shrink-0 text-chart-5" aria-hidden />
      <span>
        This platform uses 100% synthetic data &mdash; no real attacks, scans or external targets.
      </span>
    </div>
  );
}
