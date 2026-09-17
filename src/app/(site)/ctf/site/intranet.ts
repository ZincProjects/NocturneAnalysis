/**
 * A deliberately old-fashioned staff intranet for the "Robots Don't Lie"
 * challenge. Served as raw HTML from route handlers rather than React, because
 * the challenge depends on an HTML comment that React would never emit.
 */

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export function intranetPage(title: string, body: string, headExtra = ""): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} - Northwind Staff Intranet</title>
${headExtra}
<style>
  body { margin: 0; font-family: Verdana, Geneva, sans-serif; background: #e9edf2; color: #1d2a36; }
  header { background: #123a5c; color: #fff; padding: 14px 20px; border-bottom: 4px solid #e2a93b; }
  header strong { font-size: 20px; letter-spacing: .5px; }
  header span { display: block; font-size: 12px; opacity: .8; }
  nav { background: #1f4f7a; padding: 6px 20px; }
  nav a { color: #fff; margin-right: 16px; font-size: 13px; }
  main { max-width: 760px; margin: 20px auto; background: #fff; border: 1px solid #c3ccd6; padding: 20px 24px; }
  h1 { font-size: 20px; color: #123a5c; margin-top: 0; }
  li { margin: 6px 0; }
  .memo { border-left: 4px solid #b3261e; background: #fff5f4; padding: 10px 14px; }
  footer { text-align: center; font-size: 11px; color: #5b6b7a; margin: 20px; }
  .ctf { font-size: 11px; background: #fffbe6; border: 1px dashed #c9a227; padding: 6px 10px; margin-bottom: 14px; }
</style>
</head>
<body>
<header><strong>NORTHWIND POLYTECHNIC</strong><span>Staff Intranet &middot; authorised personnel only</span></header>
<nav><a href="/ctf/site">Home</a><a href="/ctf/site#news">News</a><a href="/ctf/site#it">IT Services</a><a href="/ctf/challenges">&larr; Back to Nocturne CTF</a></nav>
<main>
<p class="ctf">Nocturne CTF challenge site. Everything here is fictional and exists only for this exercise.</p>
${body}
</main>
<footer>&copy; Northwind Polytechnic IT Services &middot; Best viewed in Internet Explorer 6</footer>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
