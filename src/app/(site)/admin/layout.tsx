import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, LayoutDashboard, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getViewer } from "@/lib/auth/session";

const TABS = [
  { href: "/admin", label: "Class dashboard", icon: LayoutDashboard },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");

  // Role is enforced here and again by Row Level Security on every query. A
  // student who guesses the URL sees the redirect; a student who calls the API
  // directly gets nothing back.
  if (!viewer.isStaff) redirect("/dashboard");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Instructor console</h1>
          <Badge variant="secondary">{viewer.org.name}</Badge>
          <Badge variant="outline" className="capitalize">
            {viewer.profile.role}
          </Badge>
        </div>
        <nav className="mt-4 flex flex-wrap gap-1" aria-label="Instructor console">
          {TABS.map((tab) => (
            <Button key={tab.href} variant="ghost" size="sm" asChild>
              <Link href={tab.href}>
                <tab.icon className="size-4" />
                {tab.label}
              </Link>
            </Button>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
