import { describe, expect, it } from "vitest";

import { explainAuthError } from "@/components/auth/login-form";

describe("explainAuthError", () => {
  it("tells an unconfirmed user what to do", () => {
    expect(explainAuthError("Email not confirmed")).toMatch(/confirm your email/i);
  });

  it("points at custom SMTP when Supabase refuses to send", () => {
    expect(explainAuthError("Email address not authorized")).toMatch(/SMTP/);
    expect(explainAuthError("Error sending confirmation email")).toMatch(/SMTP/);
  });

  it("explains the email rate limit", () => {
    expect(explainAuthError("email rate limit exceeded")).toMatch(/wait a few minutes/i);
  });

  it("explains a sign-in link requested for an address with no account", () => {
    expect(explainAuthError("Signups not allowed for otp")).toMatch(/no account/i);
  });

  it("passes unknown messages through unchanged", () => {
    expect(explainAuthError("Something new")).toBe("Something new");
  });
});
