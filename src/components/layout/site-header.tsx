import Link from "next/link";
import { Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getViewer } from "@/lib/auth/session";
import { SignOutButton } from "@/components/layout/sign-out-button";

const PUBLIC_LINKS = [
  { href: "/scenarios", label: "Scenarios" },
  { href: "/mitre", label: "ATT&CK" },
  { href: "/owasp", label: "OWASP" },
  { href: "/ctf", label: "CTF" },
  { href: "/samples", label: "Sample reports" },
  { href: "/for-schools", label: "For schools" },
];

const STUDENT_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/mitre", label: "ATT&CK" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/ctf", label: "CTF" },
];

export async function SiteHeader() {
  const viewer = await getViewer();
  const links = viewer ? STUDENT_LINKS : PUBLIC_LINKS;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4">
        <Link
          href={viewer ? "/dashboard" : "/"}
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
        >
          <Radar className="size-5 text-primary" aria-hidden />
          <span>
            Nocturne<span className="text-primary">Analysis</span>
          </span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {links.map((link) => (
            <Button key={link.href} variant="ghost" size="sm" asChild>
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {viewer?.isStaff ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">Instructor console</Link>
            </Button>
          ) : null}
          <ThemeToggle />
          {viewer ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline" title="Your pseudonym">
                {viewer.profile.handle}
              </span>
              <SignOutButton />
            </>
          ) : (
            <Button size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Mobile nav: the header would otherwise lose every link on a Chromebook
          in portrait or a phone. */}
      <nav
        aria-label="Main, compact"
        className="scrollbar-thin flex items-center gap-1 overflow-x-auto border-t border-border px-2 py-1 md:hidden"
      >
        {links.map((link) => (
          <Button key={link.href} variant="ghost" size="sm" asChild className="shrink-0">
            <Link href={link.href}>{link.label}</Link>
          </Button>
        ))}
      </nav>
    </header>
  );
}
