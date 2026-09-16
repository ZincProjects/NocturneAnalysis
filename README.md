# NocturneAnalysis

A browser-based Security Operations Centre training platform for cybersecurity
students at schools and polytechnics.

Students work realistic, **entirely synthetic** security incidents through the
full professional incident response lifecycle — Triage, Investigation,
Containment, Eradication, Recovery, Lessons Learned — inside a SOC-style
console. Every action they take is appended to a tamper-evident log, which is
assembled at the end into an incident report they export.

> **This platform uses 100% synthetic data.** No real attacks, scans or
> external targets. Addresses use IETF documentation ranges and hostnames use
> reserved TLDs, so nothing in it resolves or routes. This is enforced by a
> build check, not by convention — see [Synthetic data](#synthetic-data).

- **For educators:** [FOR-SCHOOLS.md](FOR-SCHOOLS.md)
- **Licensing:** [LICENSE.md](LICENSE.md) (source-available) and
  [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)
- **Attributions:** [NOTICE](NOTICE)

---

## What is in the box

| | |
|---|---|
| **4 scenarios** | Phishing, network intrusion, web application attack, ransomware |
| **6 IR phases** | Gated in order, mapped to NIST SP 800-61 |
| **14 ATT&CK techniques** | Tagged in the console and the report, with a coverage heatmap |
| **OWASP Top 10:2021** | Mapped on the web scenario, with a plain-language reference |
| **Tamper-evident log** | SHA-256 hash chain, append-only at the database level |
| **Reports** | PDF and Markdown, generated from the event log |
| **SOC 101** | Interactive primer for students with no security background |
| **Instructor console** | Live class view, grading, comments, cohort analytics |

Scenario D continues Scenario A. Run back to back, a class sees how an incident
closed without proper eradication becomes an estate-wide event a week later.

## Quick start

```bash
git clone https://github.com/ZincProjects/NocturneAnalysis.git
cd NocturneAnalysis
npm install
cp .env.example .env.local     # fill in your Supabase values
npm run db:apply               # load the scenario library into your project
npm run dev
```

Then open <http://localhost:3000>.

`/samples`, `/scenarios`, `/mitre` and `/owasp` work immediately with no
account. To work a scenario you need to be enrolled — see
[Accounts and sign-in](#accounts-and-sign-in).

## Requirements

- Node.js 20 or later
- A Supabase project (the free tier is sufficient)

## Configuration

Copy `.env.example` to `.env.local`. Three variables are required:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key. Safe in the browser — every table is behind row-level security |
| `NEXT_PUBLIC_SITE_URL` | Absolute origin, used to build magic-link redirects |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Required for report generation and the CLI scripts |

The service-role key is needed because grading has to happen somewhere the
student cannot influence, and it writes to tables no student may write to.
It is deliberately *not* used for appending events: that path runs inside the
`append-event` Edge Function, where Supabase injects the key and it never
touches the web server.

Never prefix it with `NEXT_PUBLIC_`, and never commit it.

## Setting up the database

Migrations live in `supabase/migrations/` and run in order.

```bash
# Local development with the Supabase CLI
supabase start
supabase db reset          # applies migrations, then supabase/seed.sql

# Against a hosted project
supabase link --project-ref <ref>
supabase db push
npm run db:apply           # loads /content over PostgREST - no psql needed
```

`npm run db:seed` regenerates `supabase/seed.sql` from the content library;
`npm run db:apply` pushes the same content to a remote project directly. Use
whichever suits your environment — they produce the same rows.

Deploy the Edge Function:

```bash
supabase functions deploy append-event
```

## Accounts and sign-in

There are three ways to get an account:

1. **Class code (self-service).** Each organisation has a class code, shown to
   instructors on **Admin → Students**. A student opens `/login`, chooses
   **Create account**, and enters the code. They always join as a student -
   the role is set by the database, never by the sign-up form. Without a code
   they join the built-in *Independent Learners* organisation.
2. **Roster (instructor-managed).** Needs the service role, so it runs from
   the command line:

   ```bash
   # roster.csv: email,display name,handle,cohort
   npm run enrol -- --org "Northwind Polytechnic" --file roster.csv --dry-run
   npm run enrol -- --org "Northwind Polytechnic" --file roster.csv
   npm run enrol -- --org "Northwind Polytechnic" --file staff.csv --role instructor
   ```

   Enrolled accounts have no password. They sign in with an emailed link and
   can set a password at `/account/password`.
3. **Demo accounts.** `npm run demo:users` creates
   `student@northwind.example` and `instructor@northwind.example` in the demo
   organisation and prints a fresh password for each. The `.example` addresses
   cannot receive email, so these accounts only work with a password.

Choose handles that do not identify the student: they appear on leaderboards
and in generated reports.

### Email delivery

Sign-up confirmations, sign-in links and password resets are sent by Supabase
Auth. **Supabase's built-in email service is for testing only**: it delivers
only to members of your Supabase organisation and only a few messages an hour.
Students will not receive anything until you configure custom SMTP under
**Authentication → Emails → SMTP settings** (any provider works - Resend,
Postmark, SES, or a school mail relay).

The links in those emails also have to come back to your site. In
**Authentication → URL Configuration**, set the Site URL to your deployment
and add `https://<your-domain>/auth/callback` to the redirect URLs. Links are
opened in the browser that requested them; to make them work across devices,
change the email templates to link to
`{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` (use
`type=recovery` for the reset template) - the callback handles both forms.

## Authoring scenarios

Scenarios are files, not database rows, so they are readable and reviewable in
a pull request:

```
content/scenarios/<slug>/
  scenario.yaml          metadata, six phases, decisions, actions, hints, IOCs
  assets/alerts.json     the alert queue, including decoys and timed arrivals
  assets/logs.json       searchable log lines, including noise
  assets/documents.json  emails, EDR detections, tickets, ransom notes
```

```bash
npm run content:validate   # schema, cross-file consistency, and safety
npm run db:apply           # load into the database
npm run samples:build      # regenerate the public sample reports
```

`content:validate` is the gate. It checks that every phase is present and in
lifecycle order, that success criteria point at decisions and actions that
exist, that every mapped ATT&CK technique is in the curated subset, that the
expected answers of the technique picker match the scenario's declared
mapping — and that nothing in the content could refer to real infrastructure.

### A scenario needs

- Exactly six phases, in lifecycle order.
- At least one benign indicator among the malicious ones. Tagging it costs
  points, because false positives cost real analysts real afternoons.
- An `attack_techniques` decision in the investigation phase whose expected
  answers match `mitre_techniques` exactly. ATT&CK coverage is read from what
  the student explicitly selected, never inferred.
- `require_reflection: true` on the lessons-learned phase.
- Decoy alerts and noise log lines. Deciding what to ignore is the skill.

## Synthetic data

The product's central claim to a school's IT department is that nothing in it
points at real infrastructure. That claim is worth only as much as the check
behind it, so there is one:

`src/lib/content/safety.ts` sweeps every content file for IP addresses and
hostnames. Addresses must fall in the RFC 5737 documentation ranges
(192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) or RFC 1918 private space;
hostnames must use an RFC 2606 reserved TLD. `npm run content:validate` fails
the build on a violation, and it runs in CI.

## Evidence integrity

Every meaningful action becomes one row in `session_events`, carrying a
SHA-256 hash over the previous event's hash, the payload, the server-assigned
timestamp and the event type.

Three independent controls hold it up:

1. **No role may UPDATE or DELETE.** Not students, not instructors, not
   administrators, not the service role. A trigger raises regardless of
   privilege.
2. **Every append must reference the current chain head**, so a row cannot be
   spliced in, removed or reordered without the break showing.
3. **Only the `append-event` Edge Function can insert.** `INSERT` is revoked
   from `anon` and `authenticated`, so the browser cannot choose its own
   hashes or timestamps.

Students can watch this working — the console has a live log view with a
**Verify chain** button that recomputes every digest in the browser.

The one deliberate exception is `app.purge_student_data`, an audited erasure
path for honouring a withdrawal of consent. It is callable only by the service
role, takes an exclusive lock, restores the append-only triggers even on
failure, and records that an erasure happened without retaining what was
erased.

## Architecture

```
Browser
  │
  ├── Next.js 15 (App Router) on Vercel
  │     ├── Server Components read Supabase with the caller's session
  │     ├── /api/events  ──────────► append-event Edge Function ──► session_events
  │     └── /api/report/generate ──► grading + PDF + Markdown (Node runtime)
  │
  └── Supabase Realtime ───────────► live class view, live alert feed

Content, bundled with the deployment and never fetched at runtime:
  content/mitre/        curated ATT&CK subset, generated offline from attack-stix-data
  content/owasp/        OWASP Top 10:2021 with original plain-language explanations
  content/scenarios/    scenario definitions and synthetic assets
  content/samples/      committed sample sessions behind the public gallery
```

Two deliberate departures from the original design sketch, both documented in
the code where they apply:

- **Report generation runs in the Next.js Node runtime, not a Deno Edge
  Function.** `@react-pdf/renderer` is a Node library. Splitting grading into
  Deno and rendering into Node would mean maintaining the grading rules twice.
- **`/samples` is backed by committed fixtures, not seeded database rows.** It
  is the page you open in front of a school before any student exists, and it
  should not depend on a database being reachable and correctly seeded. The
  fixtures are replayed and graded by the same pipeline a real session uses.

## Testing

```bash
npm run test              # 90 unit and component tests
npm run test:e2e          # end-to-end
npm run typecheck
npm run lint
npm run content:validate
```

The unit suite covers the hash chain hard — tampering, deletion, reordering,
splicing, key-order insensitivity — plus the grading rules, the phase gates,
the session replay and the query language.

The end-to-end suite has two parts. The public pages run against any
deployment with no setup. The authenticated run drives a real browser through
all six phases of a real scenario against a real database and checks the
resulting report; it needs `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` in
`.env.local` and skips cleanly without them.

## Deploying

1. Push to GitHub and import the repository in Vercel.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `NEXT_PUBLIC_SITE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the project
   settings, for Production and Preview.
3. In Supabase: **Authentication → URL Configuration**, set the Site URL to
   your production origin and add `https://<origin>/auth/callback` plus your
   Vercel preview pattern as redirect URLs. Email links fail if this does not
   match. Configure custom SMTP (see [Email delivery](#email-delivery)).
4. `supabase db push` and `supabase functions deploy append-event`.
5. `npm run db:apply` to load the scenario library.

`main` is the production branch; every pull request gets a preview deployment.

## Project layout

```
content/                 scenarios, reference data, sample sessions
e2e/                     Playwright specs
scripts/                 content build, seeding, enrolment, sample generation
src/app/                 routes; (site) is the shell, /console is full-bleed
src/components/console/  the SOC workbench
src/lib/events/          event contract and the hash chain
src/lib/session/         replay - the single source of truth for a session
src/lib/grading/         rule-based grading and phase gates
src/lib/report/          report model, Markdown and PDF
supabase/migrations/     schema, RLS, integrity triggers, erasure path
supabase/functions/      Edge Functions (Deno)
tests/                   Vitest
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run test` | Unit and component tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run typecheck` | TypeScript, no emit |
| `npm run content:validate` | Schema, consistency and synthetic-data checks |
| `npm run mitre:build` | Regenerate the ATT&CK subset from the STIX bundle |
| `npm run db:seed` | Write `supabase/seed.sql` from the content library |
| `npm run db:apply` | Push the content library to a project over PostgREST |
| `npm run samples:build` | Regenerate the public sample sessions |
| `npm run enrol` | Enrol students or staff from a roster |
| `npm run demo:users` | Create or reset the demo accounts and print their passwords |
| `npm run edge:sync` | Copy shared modules into the Edge Function bundle |

## Licence

Source-available under PolyForm Noncommercial 1.0.0. Evaluating it, and running
it for a single class within your own teaching, is free. Institution-wide,
hosted or resold use requires a commercial licence.

See [LICENSE.md](LICENSE.md) and [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).
Neither is legal advice, and both contain unfilled placeholders pending review.

MITRE ATT&CK® is a registered trademark of The MITRE Corporation. OWASP® is a
registered trademark of the OWASP Foundation. Neither organisation endorses
this product. See [NOTICE](NOTICE).
