import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const sans = Inter({
  variable: "--font-sans-stack",
  subsets: ["latin"],
  display: "swap",
});

/* Log lines, hashes, command lines and IOCs all need to be read character by
   character, so the console leans on a monospace face with disambiguated
   glyphs. */
const mono = JetBrains_Mono({
  variable: "--font-mono-stack",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NocturneAnalysis - SOC analyst training for schools and polytechnics",
    template: "%s - NocturneAnalysis",
  },
  description:
    "A browser-based Security Operations Centre training platform. Students work realistic, entirely synthetic incidents through the full triage-to-lessons-learned lifecycle, mapped to MITRE ATT&CK and the OWASP Top 10.",
  applicationName: "NocturneAnalysis",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#12151c" },
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning is required by next-themes, which sets the
    // theme class on <html> before React hydrates to avoid a flash.
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} min-h-dvh antialiased`}>
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>
            <a href="#main" className="skip-link">
              Skip to main content
            </a>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
