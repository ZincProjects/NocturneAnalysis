/** "Robots Don't Lie": the intranet's robots.txt, which points straight at the loot. */

export const dynamic = "force-static";

export function GET() {
  const body = [
    "# Northwind Polytechnic staff intranet",
    "User-agent: *",
    "Disallow: /ctf/site/internal-notes",
    "Disallow: /ctf/site/cgi-bin/",
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
