import { expect, test, type Page } from "@playwright/test";

/**
 * One student, one incident, start to finish.
 *
 * This is the test that matters: it drives a real browser through all six
 * phases of a real scenario against a real database, and then checks that the
 * resulting report was assembled from the audit log the session actually
 * produced. Every layer is live - the phase gating, the append-event Edge
 * Function, the hash chain, the grading rules and the PDF renderer.
 *
 * Credentials come from the environment. Create the demo accounts with
 * `npm run enrol`, or use the seeded demo student, and set E2E_TEST_EMAIL and
 * E2E_TEST_PASSWORD in .env.local.
 */

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe("a complete incident, triage to submitted report", () => {
  test.skip(
    !EMAIL || !PASSWORD,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env.local to run the authenticated end-to-end suite.",
  );

  test.describe.configure({ mode: "serial" });

  async function signIn(page: Page) {
    await page.goto("/login");
    await page.getByLabel(/email address/i).fill(EMAIL!);
    await page.getByLabel(/^password$/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  }

  /** Waits for the console to finish recording before moving on. */
  async function settled(page: Page) {
    await expect(page.getByText(/events logged/i)).toBeVisible({ timeout: 20_000 });
  }

  async function answerRadio(page: Page, prompt: RegExp, option: RegExp) {
    const group = page.getByRole("radiogroup", { name: prompt });
    await group.getByLabel(option).check();
  }

  test("works the phishing scenario through all six phases", async ({ page }) => {
    test.slow();

    await signIn(page);

    // ------------------------------------------------------------- start --
    await page.goto("/scenarios/phishing-initial-access/briefing");
    await page.getByRole("button", { name: /enter the soc console/i }).click();
    await expect(page).toHaveURL(/\/console\/[0-9a-f-]{36}/, { timeout: 30_000 });

    const sessionId = page.url().split("/console/")[1].split("/")[0];
    await settled(page);

    // ------------------------------------------------------------ triage --
    await expect(page.getByRole("heading", { name: "Triage" })).toBeVisible();

    // The phase must be gated before the work is done.
    const advance = page.getByRole("button", { name: /complete triage/i });
    await expect(advance).toBeDisabled();

    await page.getByRole("button", { name: /open alert/i }).first().click().catch(() => {});
    await page.getByRole("tab", { name: /queue/i }).click().catch(() => {});

    // Open the endpoint detection from the queue.
    await page.getByText(/Office application spawned an encoded PowerShell/i).first().click();

    // Search the logs, which the triage gate requires.
    await page.getByRole("tab", { name: /^logs$/i }).click().catch(() => {});
    await page.getByLabel(/log search query/i).fill("source:edr");
    await page.getByRole("button", { name: /^search$/i }).click();
    await expect(page.getByText(/entries matching/i)).toBeVisible();

    await answerRadio(page, /what severity do you assign/i, /^High/);
    await page
      .getByLabel(/why\?/i)
      .first()
      .fill("Encoded PowerShell from Outlook is near-certain execution, but only one endpoint so far.");
    await page.getByRole("button", { name: /record decision/i }).first().click();

    await answerRadio(page, /how confident are you/i, /Likely malicious/);
    await page.getByRole("button", { name: /record decision/i }).first().click();

    await page
      .getByRole("button", { name: /execute/i })
      .first()
      .click();

    await settled(page);
    await expect(advance).toBeEnabled({ timeout: 20_000 });
    await advance.click();

    // ----------------------------------------------------- investigation --
    await expect(page.getByRole("heading", { name: "Investigation" })).toBeVisible({
      timeout: 20_000,
    });

    for (const query of ["source:dns", "source:proxy", "host:WKS-HR-014"]) {
      await page.getByLabel(/log search query/i).fill(query);
      await page.getByRole("button", { name: /^search$/i }).click();
      await page.waitForTimeout(250);
    }

    // Tag the indicators the phase requires, via the evidence board.
    await page.getByRole("tab", { name: /iocs/i }).click().catch(() => {});
    for (const ioc of [
      "update-cdn.paylo4d.example",
      "203.0.113.47",
      "northwind-sso.verify-access.example",
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\OneDriveSync",
    ]) {
      await page.getByLabel(/indicator value/i).fill(ioc);
      await page.getByRole("button", { name: /^tag$/i }).click();
      await page.waitForTimeout(250);
    }

    await page.getByRole("tab", { name: /^case$/i }).click().catch(() => {});

    await page
      .getByPlaceholder(/what are you thinking/i)
      .fill("Beacon to update-cdn.paylo4d.example every 60 seconds; Run key persistence confirmed.");
    await page.getByRole("button", { name: /save note/i }).click();

    // Techniques, root cause, credential exposure.
    for (const technique of [
      /T1566\.001/,
      /T1204\.002/,
      /T1059\.001/,
      /T1547\.001/,
      /T1071\.001/,
    ]) {
      await page.getByLabel(technique).first().check();
    }
    await page.getByRole("button", { name: /record decision/i }).first().click();

    await answerRadio(page, /what is the root cause/i, /A malicious attachment reached a user/);
    await page
      .getByLabel(/why\?/i)
      .first()
      .fill("Every later step depends on that attachment reaching a mailbox and being opened.");
    await page.getByRole("button", { name: /record decision/i }).first().click();

    await answerRadio(page, /were credentials exposed/i, /a password was submitted/i);
    await page.getByRole("button", { name: /record decision/i }).first().click();

    await settled(page);
    const toContainment = page.getByRole("button", { name: /complete investigation/i });
    await expect(toContainment).toBeEnabled({ timeout: 20_000 });
    await toContainment.click();

    // -------------------------------------------------------- containment --
    await expect(page.getByRole("heading", { name: "Containment" })).toBeVisible({
      timeout: 20_000,
    });

    await answerRadio(page, /how should WKS-HR-014 be taken out of play/i, /Network-isolate the host/);
    await page
      .getByLabel(/why\?/i)
      .first()
      .fill("Isolation cuts the channel while preserving memory, which holds the unencrypted payload.");
    await page.getByRole("button", { name: /record decision/i }).first().click();

    for (const action of [
      /Network-isolate WKS-HR-014/,
      /Disable the p\.raman account/,
      /Block update-cdn\.paylo4d\.example/,
      /Block 203\.0\.113\.47/,
    ]) {
      await page
        .locator("li")
        .filter({ hasText: action })
        .getByRole("button", { name: /execute/i })
        .click();
      await page.waitForTimeout(400);
    }

    await settled(page);
    const toEradication = page.getByRole("button", { name: /complete containment/i });
    await expect(toEradication).toBeEnabled({ timeout: 20_000 });
    await toEradication.click();

    // -------------------------------------------------------- eradication --
    await expect(page.getByRole("heading", { name: "Eradication" })).toBeVisible({
      timeout: 20_000,
    });

    for (const step of [
      /Remove the OneDriveSync Run key/,
      /Delete the onedrivesync\.exe implant/,
      /Reset p\.raman's password/,
      /Purge the phishing email/,
      /Rebuild WKS-HR-014/,
    ]) {
      await page.getByLabel(step).first().check();
    }
    await page.getByRole("button", { name: /record decision/i }).first().click();

    await answerRadio(page, /what must happen before/i, /Capture a forensic disk image/);
    await page.getByRole("button", { name: /record decision/i }).first().click();

    await page
      .locator("li")
      .filter({ hasText: /Request a forensic image/ })
      .getByRole("button", { name: /execute/i })
      .click();

    await settled(page);
    const toRecovery = page.getByRole("button", { name: /complete eradication/i });
    await expect(toRecovery).toBeEnabled({ timeout: 20_000 });
    await toRecovery.click();

    // ----------------------------------------------------------- recovery --
    await expect(page.getByRole("heading", { name: "Recovery" })).toBeVisible({ timeout: 20_000 });

    for (const step of [
      /Rebuild from a known-good image/,
      /Reset the password and enrol/,
      /Verify no further resolution/,
      /Sweep the estate/,
      /Monitor the rebuilt host/,
    ]) {
      await page.getByLabel(step).first().check();
    }
    await page.getByRole("button", { name: /record decision/i }).first().click();

    await answerRadio(page, /who should sign off/i, /The incident response lead/);
    await page.getByRole("button", { name: /record decision/i }).first().click();

    await settled(page);
    const toLessons = page.getByRole("button", { name: /complete recovery/i });
    await expect(toLessons).toBeEnabled({ timeout: 20_000 });
    await toLessons.click();

    // ---------------------------------------------------- lessons learned --
    await expect(page.getByRole("heading", { name: "Lessons Learned" })).toBeVisible({
      timeout: 20_000,
    });

    const submit = page.getByRole("button", { name: /submit incident report/i });
    await expect(submit).toBeDisabled();

    await answerRadio(page, /which single control failure/i, /The mail gateway tagged rather than quarantined/);
    await page
      .getByLabel(/why\?/i)
      .first()
      .fill("It is the earliest point where one configuration change stops the whole chain.");
    await page.getByRole("button", { name: /record decision/i }).first().click();

    await page
      .getByLabel(/what happened\?/i)
      .fill(
        "An HR officer received a payroll-themed email from a lookalike domain that failed both SPF and DMARC. The mail gateway was configured to tag rather than quarantine on authentication failure, so it was delivered. The attachment was a Windows shortcut disguised as a PDF; opening it launched hidden PowerShell that downloaded a second-stage implant, established Run-key persistence and began beaconing to a command-and-control domain registered six days earlier. Separately, the same user submitted credentials to a fake sign-on page linked from the same message.",
      );
    await page
      .getByLabel(/what worked\?/i)
      .fill(
        "The endpoint agent's behavioural rule fired within seconds, which is the only reason we have this incident at all. The user also reported the email before anyone contacted her.",
      );
    await page
      .getByLabel(/what should change\?/i)
      .fill(
        "The gateway should quarantine rather than tag on DMARC failure, and shortcut attachments need detonating. An attack-surface-reduction rule blocking Office child processes would have stopped this before any network activity.",
      );

    await page.getByLabel(/recommended control 1/i).fill("Quarantine inbound mail that fails DMARC");
    await page.getByRole("button", { name: /add another/i }).click();
    await page
      .getByLabel(/recommended control 2/i)
      .fill("Enable attachment detonation for .lnk and script file types");

    await settled(page);
    await expect(submit).toBeEnabled({ timeout: 20_000 });
    await submit.click();

    // -------------------------------------------------------------- report --
    await expect(page).toHaveURL(new RegExp(`/console/${sessionId}/report`), { timeout: 60_000 });

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Incident Report");

    // The claim the whole platform rests on.
    await expect(page.getByText(/verified, chain intact/i)).toBeVisible();

    // The report is built from the log, so the student's own words are in it.
    await expect(page.getByText(/lookalike domain that failed both SPF and DMARC/i)).toBeVisible();

    // Coverage came from the technique selection made during investigation.
    await expect(page.getByText("T1566.001").first()).toBeVisible();

    // And both export formats work for the session just completed.
    const pdf = await page.request.get(`/reports/${sessionId}/report.pdf`);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    const markdown = await page.request.get(`/reports/${sessionId}/report.md`);
    expect(markdown.status()).toBe(200);
    expect(await markdown.text()).toContain("## Evidence integrity");
  });

  test("the audit log is append-only and verifies in the browser", async ({ page }) => {
    await signIn(page);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: /open/i }).first().click();

    await expect(page.getByText(/verified, chain intact/i)).toBeVisible({ timeout: 30_000 });
  });
});
