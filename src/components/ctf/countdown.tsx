"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/**
 * Counts down to `target` using the server's clock, not the laptop's - school
 * machines are often minutes out. Refreshes the page when it reaches zero, so
 * the challenge grid appears (or submissions close) without a manual reload.
 */
export function Countdown({
  target,
  serverNow,
  size = "lg",
  className,
}: {
  target: string;
  serverNow: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const offset = useRef<number | null>(null);
  const [remaining, setRemaining] = useState(() => Date.parse(target) - Date.parse(serverNow));
  const refreshed = useRef(false);

  useEffect(() => {
    offset.current = Date.parse(serverNow) - Date.now();
    const tick = () => {
      const left = Date.parse(target) - (Date.now() + (offset.current ?? 0));
      setRemaining(left);
      if (left <= 0 && !refreshed.current) {
        refreshed.current = true;
        setTimeout(() => router.refresh(), 800);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target, serverNow, router]);

  const { days, hours, minutes, seconds } = parts(remaining);
  const units = [
    ...(days > 0 ? [{ value: days, label: days === 1 ? "day" : "days" }] : []),
    { value: hours, label: "hr" },
    { value: minutes, label: "min" },
    { value: seconds, label: "sec" },
  ];

  if (size === "sm") {
    return (
      <span className={cn("font-mono tabular-nums", className)}>
        {days > 0 ? `${days}d ` : ""}
        {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
        {String(seconds).padStart(2, "0")}
      </span>
    );
  }

  return (
    <div className={cn("flex gap-3", className)} role="timer" aria-live="off">
      {units.map((unit) => (
        <div
          key={unit.label}
          className="flex min-w-16 flex-col items-center rounded-lg border border-border bg-secondary/60 px-3 py-2"
        >
          <span className="font-mono text-3xl font-semibold tabular-nums">
            {String(unit.value).padStart(2, "0")}
          </span>
          <span className="text-xs text-muted-foreground">{unit.label}</span>
        </div>
      ))}
    </div>
  );
}
