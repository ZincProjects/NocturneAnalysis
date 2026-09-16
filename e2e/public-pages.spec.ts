import { expect, test } from "@playwright/test";

/**
 * The pages a prospective school sees before anyone signs in.
 *
 * These matter commercially as much as the console does: they are what gets
 * opened in a meeting, and they must work with no account and no database
 * round trip.
 */

test.describe("public pages", () => {
  test("the landing page states the synthetic-data guarantee", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /teach students what a soc shift actually feels like/i }),
    ).toBeVisible();

    // The disclaimer is the claim an IT department checks first, so it is on
    // every page rather than buried in a policy link.
    await expect(page.getByText(/100% synthetic data/i).first()).toBeVisible();
  });

  test("the scenario library lists all four launch scenarios", async ({ page }) => {
    await page.goto("/scenarios");

    await expect(page.getByRole("heading", { name: "Scenario library" })).toBeVisible();

    for (const title of [
      /Payroll Pressure/,
      /The Night Shift/,
      /Query Unfiltered/,
      /Seven Days Later/,
    ]) {
      await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
    }
  });

  test("a briefing shows its ATT&CK mapping and the six phases", async ({ page }) => {
    await page.goto("/scenarios/phishing-initial-access/briefing");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Payroll Pressure");
    await expect(page.getByText("T1566.001").first()).toBeVisible();

    for (const phase of [
      "Triage",
      "Investigation",
      "Containment",
      "Eradication",
      "Recovery",
      "Lessons Learned",
    ]) {
      await expect(page.getByText(phase, { exact: true }).first()).toBeVisible();
    }
  });

  test("the web scenario shows its OWASP mapping", async ({ page }) => {
    await page.goto("/scenarios/webapp-sql-injection/briefing");

    await expect(page.getByText("A03:2021").first()).toBeVisible();
    await expect(page.getByText("A05:2021").first()).toBeVisible();
    await expect(page.getByText("A07:2021").first()).toBeVisible();
  });

  test("sample reports are readable without an account", async ({ page }) => {
    await page.goto("/samples");

    await expect(page.getByRole("heading", { name: "Sample incident reports" })).toBeVisible();
    await expect(page.getByText("Chain verified").first()).toBeVisible();

    await page.getByRole("link", { name: /read the report/i }).first().click();

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Incident Report");
    await expect(page.getByText(/verified, chain intact/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /indicators of compromise/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /lessons learned/i })).toBeVisible();
  });

  test("a sample report downloads as a PDF", async ({ page }) => {
    const response = await page.request.get("/samples/phishing-initial-access/report.pdf");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");

    const body = await response.body();
    expect(body.byteLength).toBeGreaterThan(10_000);
    // Every PDF begins with this signature.
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("a sample report downloads as Markdown", async ({ page }) => {
    const response = await page.request.get("/samples/phishing-initial-access/report.md");

    expect(response.status()).toBe(200);
    const text = await response.text();

    expect(text).toContain("# Incident Report");
    expect(text).toContain("## Evidence integrity");
    expect(text).toContain("## MITRE ATT&CK coverage");
    expect(text).toContain("## Lessons learned");
  });

  test("the ATT&CK page shows library coverage", async ({ page }) => {
    await page.goto("/mitre");

    await expect(page.getByRole("heading", { name: /MITRE ATT&CK coverage/i })).toBeVisible();
    await expect(page.getByText(/techniques taught across/i)).toBeVisible();
  });

  test("the OWASP page explains all ten categories", async ({ page }) => {
    await page.goto("/owasp");

    for (const code of ["A01:2021", "A05:2021", "A10:2021"]) {
      await expect(page.getByText(code, { exact: true }).first()).toBeVisible();
    }
  });

  test("the licensing page is explicit that it is not legal advice", async ({ page }) => {
    await page.goto("/legal");

    await expect(page.getByRole("heading", { name: "Licensing" })).toBeVisible();
    await expect(page.getByText(/not legal advice/i).first()).toBeVisible();
    await expect(page.getByText(/PolyForm Noncommercial/i).first()).toBeVisible();
  });

  test("a signed-out visitor is sent to sign in for private pages", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
