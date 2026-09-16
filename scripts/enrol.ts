/**
 * Enrols students into an organisation.
 *
 *   npm run enrol -- --org "Northwind Polytechnic" --file roster.csv
 *   npm run enrol -- --org "Northwind Polytechnic" --file roster.csv --dry-run
 *
 * Roster format, one student per line:
 *
 *   email,display name,handle,cohort
 *
 * Students are created without a password and sign in with a magic link. That
 * is not a limitation to work around - a platform that teaches people to
 * recognise credential phishing should not be handing out passwords over email.
 *
 * This runs from the command line rather than from a browser form because it
 * needs the service-role credential. Exposing account creation to a logged-in
 * session would mean one compromised instructor account could create accounts
 * across the tenant.
 */

import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

import type { Database } from "@/lib/supabase/database.types";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

interface RosterEntry {
  email: string;
  displayName: string;
  handle: string;
  cohort: string | null;
  line: number;
}

const HANDLE_RE = /^[A-Za-z0-9_.-]{3,32}$/;

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function parseRoster(contents: string): { entries: RosterEntry[]; errors: string[] } {
  const entries: RosterEntry[] = [];
  const errors: string[] = [];
  const seenEmails = new Set<string>();
  const seenHandles = new Set<string>();

  contents.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;

    const parts = line.split(",").map((p) => p.trim());
    const lineNo = index + 1;

    if (parts.length < 3) {
      errors.push(`line ${lineNo}: expected "email,display name,handle[,cohort]"`);
      return;
    }

    const [email, displayName, handle, cohort] = parts;

    if (!email.includes("@")) errors.push(`line ${lineNo}: "${email}" is not an email address`);
    if (!displayName) errors.push(`line ${lineNo}: display name is empty`);
    if (!HANDLE_RE.test(handle)) {
      errors.push(
        `line ${lineNo}: handle "${handle}" must be 3-32 characters of letters, digits, dot, dash or underscore`,
      );
    }
    if (seenEmails.has(email.toLowerCase())) {
      errors.push(`line ${lineNo}: "${email}" appears more than once in this file`);
    }
    if (seenHandles.has(handle.toLowerCase())) {
      errors.push(`line ${lineNo}: handle "${handle}" appears more than once in this file`);
    }

    seenEmails.add(email.toLowerCase());
    seenHandles.add(handle.toLowerCase());

    entries.push({
      email: email.toLowerCase(),
      displayName,
      handle,
      cohort: cohort || null,
      line: lineNo,
    });
  });

  return { entries, errors };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const orgName = typeof args.org === "string" ? args.org : null;
  const file = typeof args.file === "string" ? args.file : null;
  const dryRun = Boolean(args["dry-run"]);
  const role = typeof args.role === "string" ? args.role : "student";

  if (!orgName || !file) {
    console.error(
      'Usage: npm run enrol -- --org "Organisation Name" --file roster.csv [--dry-run] [--role instructor]\n\n' +
        "Roster lines look like:\n  a.lim@school.edu.example,Amelia Lim,swift.kestrel,DIT-Y2-A",
    );
    process.exit(1);
  }

  if (!["student", "instructor", "admin"].includes(role)) {
    console.error(`--role must be student, instructor or admin (got "${role}")`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
        "The service-role key is in Dashboard > Project Settings > API. Never commit it.",
    );
    process.exit(1);
  }

  const rosterPath = path.resolve(file);
  if (!fs.existsSync(rosterPath)) {
    console.error(`No such file: ${rosterPath}`);
    process.exit(1);
  }

  const { entries, errors } = parseRoster(fs.readFileSync(rosterPath, "utf8"));

  if (errors.length > 0) {
    console.error(`\nThe roster has ${errors.length} problem(s):\n`);
    for (const error of errors) console.error(`  ${error}`);
    console.error("\nNothing was enrolled. Fix the file and run again.\n");
    process.exit(1);
  }

  if (entries.length === 0) {
    console.error("The roster is empty.");
    process.exit(1);
  }

  const db = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: org } = await db
    .from("organizations")
    .select("id, name")
    .eq("name", orgName)
    .maybeSingle();

  if (!org) {
    const { data: available } = await db.from("organizations").select("name");
    console.error(
      `No organisation called "${orgName}".\n\nAvailable:\n${(available ?? [])
        .map((o) => `  ${o.name}`)
        .join("\n")}`,
    );
    process.exit(1);
  }

  process.stdout.write(
    `\n${dryRun ? "DRY RUN - " : ""}Enrolling ${entries.length} ${role}(s) into ${org.name}\n\n`,
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of entries) {
    // A handle collision inside the organisation is a unique-constraint
    // violation, but catching it here produces a message that says which line
    // of the file to fix.
    const { data: handleTaken } = await db
      .from("profiles")
      .select("id")
      .eq("org_id", org.id)
      .eq("handle", entry.handle)
      .maybeSingle();

    if (handleTaken) {
      process.stdout.write(`  skip   ${entry.email.padEnd(38)} handle "${entry.handle}" already used in this org\n`);
      skipped += 1;
      continue;
    }

    if (dryRun) {
      process.stdout.write(`  would  ${entry.email.padEnd(38)} ${entry.handle} ${entry.cohort ?? ""}\n`);
      created += 1;
      continue;
    }

    const { data: user, error: userError } = await db.auth.admin.createUser({
      email: entry.email,
      email_confirm: true,
      user_metadata: { display_name: entry.displayName },
    });

    if (userError || !user?.user) {
      // An existing account is a normal outcome when re-running a roster.
      if (userError?.message?.toLowerCase().includes("already been registered")) {
        process.stdout.write(`  skip   ${entry.email.padEnd(38)} account already exists\n`);
        skipped += 1;
        continue;
      }
      process.stdout.write(`  FAIL   ${entry.email.padEnd(38)} ${userError?.message}\n`);
      failed += 1;
      continue;
    }

    const { error: profileError } = await db.from("profiles").insert({
      id: user.user.id,
      org_id: org.id,
      role: role as Database["public"]["Enums"]["user_role"],
      display_name: entry.displayName,
      handle: entry.handle,
      cohort: entry.cohort,
    });

    if (profileError) {
      process.stdout.write(`  FAIL   ${entry.email.padEnd(38)} ${profileError.message}\n`);
      failed += 1;
      continue;
    }

    process.stdout.write(`  ok     ${entry.email.padEnd(38)} ${entry.handle}\n`);
    created += 1;
  }

  process.stdout.write(
    `\n${dryRun ? "Would create" : "Created"} ${created}, skipped ${skipped}, failed ${failed}.\n`,
  );

  if (!dryRun && created > 0) {
    process.stdout.write(
      "\nStudents sign in at /login by requesting a link. No passwords were set.\n",
    );
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
