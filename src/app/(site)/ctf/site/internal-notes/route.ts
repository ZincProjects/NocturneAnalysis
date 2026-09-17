import { ctfDb } from "@/lib/ctf/server";

import { escapeHtml, intranetPage } from "../intranet";

/**
 * "Robots Don't Lie": the page robots.txt asks crawlers to skip. The flag sits
 * in an HTML comment, visible to anyone who views the source. It is read from
 * the database so that it is not committed to the repository.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const db = ctfDb();
  const { data } = db ? await db.rpc("ctf_intranet_memo") : { data: null };

  if (!data) {
    return intranetPage(
      "Internal notes",
      `<h1>Internal notes</h1><p>This page is being updated. Check back when the CTF is running.</p>`,
    );
  }

  return intranetPage(
    "Internal notes",
    `<h1>Internal notes - DO NOT DISTRIBUTE</h1>
<div class="memo">
  <p><b>From:</b> IT Services<br><b>To:</b> Web team<br><b>Re:</b> Hiding the admin pages</p>
  <p>We have added this page to robots.txt so Google will not index it. That should keep it private.</p>
  <p>The old admin credentials are in the page source for now. We will move them before the audit.</p>
</div>
<!-- TODO remove before audit: ${escapeHtml(data as string)} -->
<p>Last updated by <i>webmaster</i>.</p>`,
  );
}
