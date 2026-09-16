/**
 * Creates (or resets) the two demo accounts in the demo organisation:
 *
 *   student@northwind.example     handle night.owl     role student
 *   instructor@northwind.example  handle lead.analyst  role instructor
 *
 *   npm run demo:users
 *
 * Each run sets a fresh random password and prints it once. Set
 * DEMO_STUDENT_PASSWORD / DEMO_INSTRUCTOR_PASSWORD in .env.local to choose them
 * instead. The addresses use the reserved .example TLD, so no mail is ever sent
 * to them - these accounts can only be used with a password.
 *
 * Accounts are created through the Auth admin API rather than by inserting
 * into auth.users by hand, which leaves columns Supabase Auth needs unset and
 * makes every sign-in fail with "Database error querying schema".
 */

import crypto from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

import type { Database } from "@/lib/supabase/database.types";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const ORG_NAME = "Northwind Polytechnic (Demo)";

const ACCOUNTS = [
  {
    email: "student@northwind.example",
    handle: "night.owl",
    displayName: "Demo Student",
    role: "student" as const,
    passwordEnv: "DEMO_STUDENT_PASSWORD",
  },
  {
    email: "instructor@northwind.example",
    handle: "lead.analyst",
    displayName: "Demo Instructor",
    role: "instructor" as const,
    passwordEnv: "DEMO_INSTRUCTOR_PASSWORD",
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  }

  const db = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let { data: org } = await db.from("organizations").select("id, join_code").eq("name", ORG_NAME).maybeSingle();
  if (!org) {
    const created = await db
      .from("organizations")
      .insert({ name: ORG_NAME, kind: "demo", leaderboard_enabled: true })
      .select("id, join_code")
      .single();
    if (created.error) throw created.error;
    org = created.data;
  }

  // listUsers is paginated; the demo project is small, but look past page one.
  const existing = new Map<string, string>();
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) if (user.email) existing.set(user.email.toLowerCase(), user.id);
    if (data.users.length < 1000) break;
  }

  process.stdout.write(`\n${ORG_NAME}  (class code ${org.join_code})\n\n`);

  for (const account of ACCOUNTS) {
    const password = process.env[account.passwordEnv] || `Demo-${crypto.randomBytes(12).toString("base64url")}`;
    let userId = existing.get(account.email);

    if (userId) {
      const { error } = await db.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        app_metadata: { provisioned: true },
      });
      if (error) throw error;
    } else {
      const { data, error } = await db.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: { display_name: account.displayName },
        app_metadata: { provisioned: true },
      });
      if (error || !data.user) throw error ?? new Error("createUser returned no user");
      userId = data.user.id;
    }

    const { error: profileError } = await db.from("profiles").upsert(
      {
        id: userId,
        org_id: org.id,
        role: account.role,
        display_name: account.displayName,
        handle: account.handle,
      },
      { onConflict: "id" },
    );
    if (profileError) throw profileError;

    process.stdout.write(`  ${account.role.padEnd(11)} ${account.email.padEnd(30)} ${password}\n`);
  }

  process.stdout.write("\nSign in at /login with the email and password above.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
