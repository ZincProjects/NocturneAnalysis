<!--
  The one-pager. Mirrored by the /for-schools page.

  Written for two readers who will both be in the room: a vice-principal or
  head of department who needs to know what it is and whether it is safe, and a
  technical lecturer or IT manager who will ask harder questions. Neither is
  served by marketing copy.
-->

# NocturneAnalysis for schools and polytechnics

**A browser-based SOC analyst training platform. Students work realistic,
entirely synthetic security incidents through the full professional incident
response lifecycle and produce a report at the end.**

---

## What it is

Students log in, pick or are assigned a scenario, and work it inside a
simplified Security Operations Centre console: an alert queue, a log search
tool, evidence documents, an indicator board and a case panel.

They move through six phases in order — **Triage, Investigation, Containment,
Eradication, Recovery, Lessons Learned** — mapped to the NIST SP 800-61
incident handling lifecycle used by the profession. Each phase is gated: a
student cannot advance until the minimum work is genuinely done.

Every meaningful action is timestamped into a tamper-evident log, which is
assembled at the end into an incident report the student exports as PDF or
Markdown.

**Four scenarios at launch**, spanning the attack classes a syllabus needs to
cover:

| Scenario | Class | Level | Time |
|---|---|---|---|
| Payroll Pressure | Phishing to endpoint compromise | Beginner | ~45 min |
| The Night Shift | Network intrusion and data exfiltration | Intermediate | ~60 min |
| Query Unfiltered | Web application attack (OWASP-mapped) | Intermediate | ~55 min |
| Seven Days Later | Ransomware across the estate | Advanced | ~75 min |

The ransomware scenario continues the phishing one. Assigned back to back, a
class sees how an incident closed without proper eradication becomes an
estate-wide event a week later — which is a lesson that lands far harder as an
experience than as a slide.

## Safety: the answer your IT department will want

**This platform uses 100% synthetic data. There are no real attacks, no
scanning, no external network activity and no victim infrastructure.**

Every alert, log line, email, file hash and indicator is generated content
stored in the application's own database. Specifically:

- IP addresses come from the IETF documentation ranges reserved for exactly
  this purpose (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) or from private
  address space. None of them route anywhere.
- Hostnames use reserved TLDs (`.example`, `.test`, `.invalid`). None of them
  resolve.
- The fictional institution, its staff and its systems are invented.

This is not a promise, it is a build step. `npm run content:validate` scans
every content file and **fails the build** if any address or hostname could
refer to real infrastructure. The check is in the repository
(`src/lib/content/safety.ts`) and you are welcome to read it.

Nothing in the platform teaches or performs an attack against a real system.
Students analyse evidence and make response decisions. There is no exploit
tooling, no payload delivery and no capability that could be turned outward.

## Curriculum fit

- **MITRE ATT&CK.** Every scenario is mapped to the techniques it exercises,
  tagged throughout the console and the report. A coverage heatmap at `/mitre`
  shows exactly what the library teaches, so you can check syllabus fit before
  committing rather than after.
- **OWASP Top 10:2021.** The web application scenario carries its A03, A05 and
  A07 mapping, and `/owasp` is a plain-language reference for all ten
  categories.
- **NIST SP 800-61.** The six phases map directly onto the standard lifecycle.
- **SOC 101.** A built-in primer for students with no security background,
  covering what a SOC does, how escalation works, severity versus confidence,
  alert fatigue, and why evidence integrity matters. Fifteen minutes, with a
  short comprehension check.

## Assessment

Every student action becomes one immutable, server-timestamped row in a
SHA-256 hash chain. Each event's digest covers the previous event's digest, so
altering, deleting, inserting or reordering any event breaks the chain visibly
at that point.

No role can edit or delete that log. Not students, not instructors, not
administrators — it is enforced by database triggers, not by application code.

For assessment this means:

- The generated report is a projection of the log, so it cannot disagree with
  what the student actually did.
- Integrity is verifiable with one click, by an instructor or a moderator.
- The raw event log exports as JSON or CSV for external moderation.
- Grading is rule-based against expectations declared in the scenario file, not
  free-text pattern matching. Students' written reasoning is collected and
  shown to you, and an instructor can adjust any grade — which is also recorded
  as a new event rather than an edit.

## Privacy and data protection

Built for a context where a significant share of users are minors:

- **Pseudonymous by default.** Students choose a handle. It is the only name
  that appears on leaderboards or in generated reports. Real names are visible
  only to staff in the same institution.
- **Leaderboards are off by default.** Competitive ranking suits some
  classrooms and not others; the private setting is the one that requires no
  action.
- **Minimal collection.** An email address, a display name, a handle and an
  optional cohort. Nothing else.
- **Tenant isolation.** Every table is protected by row-level security. One
  institution's data is not reachable from another's session.
- **Erasure.** An audited deletion path honours a withdrawal of consent while
  retaining proof that the erasure happened — counts and a pseudonym, never the
  erased content.

**Singapore's PDPA applies to this deployment.** The platform provides the
technical controls; the retention policy, the processor agreement and the
privacy notice are decisions for your institution and the licensor together.
Neither this document nor the repository is legal advice, and the licensor's
own terms are pending legal review.

## Accessibility and hardware

- Runs in a browser. Nothing to install, nothing to configure on a lab machine.
- Responsive down to a Chromebook screen; the console reflows to tabs on
  narrow displays.
- Keyboard-navigable throughout, with visible focus indicators.
- Built to WCAG 2.1 AA. Severity is carried by colour *and* by text, never
  colour alone. **This has not been independently audited**, and we would
  rather say so than claim conformance we cannot evidence.
- Dark and light themes. The light theme exists because dark interfaces wash
  out on classroom projectors.
- Reference data is bundled with the deployment, so a demonstration on a
  throttled school network behaves exactly like one on a fast connection.

## Licensing

Source-available, not open source.

| Tier | Price | Scope |
|---|---|---|
| Free Classroom Trial | Free | One cohort, one instructor, [TBD] weeks |
| Single Educator | [TBD]/year | One instructor and their classes |
| Institution-Wide Annual | [TBD]/year | Unlimited staff and students, banded by enrolment |

Evaluating it, and running it for a single class within your own teaching, is
free and always will be. See [LICENSE.md](LICENSE.md) and
[COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

*Pricing is not yet set. The figures above are placeholders pending legal and
commercial review.*

## See it without talking to anyone

Complete sample reports are published at **`/samples`**, no account required.
They are produced by the real grading and rendering pipeline from real session
logs, including the missed indicators and the hints taken — not mock-ups. The
scenario library at **`/scenarios`** is also public.

## Contact

[LICENSOR NAME]
[CONTACT EMAIL]
[WEBSITE]
