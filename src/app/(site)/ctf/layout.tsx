import Link from "next/link";
import { Flag } from "lucide-react";

import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/ctf", label: "Overview" },
  { href: "/ctf/challenges", label: "Challenges" },
  { href: "/ctf/scoreboard", label: "Scoreboard" },
];

export default function CtfLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="border-b border-border bg-card/40">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-2 overflow-x-auto px-4 py-2">
          <span className="mr-2 flex shrink-0 items-center gap-1.5 text-sm font-semibold">
            <Flag className="size-4 text-primary" aria-hidden /> Nocturne CTF
          </span>
          <nav aria-label="CTF" className="flex items-center gap-1">
            {LINKS.map((link) => (
              <Button key={link.href} variant="ghost" size="sm" asChild className="shrink-0">
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}
