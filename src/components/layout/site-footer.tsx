import Link from "next/link";

import { getAttackDataVersion } from "@/lib/content/loader";

const FOOTER_LINKS = [
  { href: "/for-schools", label: "For schools" },
  { href: "/samples", label: "Sample reports" },
  { href: "/mitre", label: "ATT&CK coverage" },
  { href: "/owasp", label: "OWASP Top 10" },
  { href: "/legal", label: "Licensing" },
];

export function SiteFooter() {
  const attack = getAttackDataVersion();

  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 text-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="font-semibold">NocturneAnalysis</p>
          <p className="max-w-md text-xs text-muted-foreground">
            A browser-based SOC training platform for schools and polytechnics. All incident content
            is synthetic.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-col gap-2">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="max-w-xs space-y-2 text-xs text-muted-foreground">
          <p>
            MITRE ATT&amp;CK&reg; v{attack.attack_version} content is &copy; The MITRE Corporation,
            used under the ATT&amp;CK Terms of Use. OWASP Top 10 content is &copy; the OWASP
            Foundation under CC BY-SA 4.0. Neither organisation endorses this product.
          </p>
          <p>Source-available under PolyForm Noncommercial 1.0.0. See LICENSE.md.</p>
        </div>
      </div>
    </footer>
  );
}
