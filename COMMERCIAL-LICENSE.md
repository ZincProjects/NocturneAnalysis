<!--
  NOT LEGAL ADVICE. This is a drafting starting point, not a contract.

  Every figure below is a placeholder. Nothing here has been reviewed by a
  lawyer, and commercial terms for education customers vary considerably by
  jurisdiction - procurement rules, GST treatment, data residency obligations
  and public-sector purchasing frameworks all bear on it.

  Before quoting a price or signing anything, have a qualified lawyer review
  this alongside LICENSE.md and FOR-SCHOOLS.md.
-->

# Commercial License

[LICENSE.md](LICENSE.md) places NocturneAnalysis under PolyForm Noncommercial
1.0.0. That covers evaluation and noncommercial use. This document describes
when a paid licence is needed instead, and what it is expected to include.

## When you need one

You need a commercial licence if you intend to:

- Deploy NocturneAnalysis across an institution as part of paid provision -
  fee-paying courses, funded training programmes, or commercial short courses.
- Host it for third parties, whether as a service, inside a managed offering,
  or on behalf of another institution.
- Resell, sublicense or redistribute it, modified or not, for a fee.
- Incorporate any part of it into a commercial product.

You do **not** need one to:

- Evaluate it, for as long as you reasonably need to decide.
- Run it for a single class or club within your own institution's ordinary
  teaching.
- Read, fork, modify or self-host it for noncommercial purposes.
- Use the published sample reports as evaluation material.

If your situation is genuinely unclear, ask rather than guess. The intent is
that a teacher trying this with their students never has to think about
licensing, and an organisation making money from it does.

## Proposed tiers

All figures are placeholders pending pricing research and legal review.

### Free Classroom Trial

| | |
|---|---|
| **Price** | Free |
| **Scope** | One cohort, up to [TBD] students, one instructor |
| **Term** | [TBD] weeks |
| **Includes** | Full scenario library, reports, instructor console |
| **Support** | Community / best-effort email |

Intended to be genuinely usable rather than a crippled demo. A teacher should
be able to run a real unit of work on it and reach a decision on the evidence.

### Single Educator

| | |
|---|---|
| **Price** | [TBD] per year |
| **Scope** | One instructor, up to [TBD] students across their own classes |
| **Includes** | Everything in the trial, plus scenario updates for the term of the licence |
| **Support** | Email, [TBD] business-day response |

For an individual lecturer running a cybersecurity elective or a CTF club,
typically purchasing on a departmental budget rather than through procurement.

### Institution-Wide Annual

| | |
|---|---|
| **Price** | [TBD] per year, banded by enrolment |
| **Scope** | Unlimited instructors and students within one institution |
| **Includes** | Everything above, plus SSO integration, cohort analytics, data-residency options |
| **Support** | Priority email, [TBD] business-day response, onboarding session |

For a department or whole institution. Expect procurement, a security
questionnaire and a data protection impact assessment; the answers to most of
what they will ask are in [FOR-SCHOOLS.md](FOR-SCHOOLS.md).

### Hosting and Reseller

Negotiated individually. Contact [CONTACT EMAIL].

## What a commercial licence is expected to cover

- The right to use NocturneAnalysis for the commercial purposes described, for
  the licence term, within the stated scope.
- Updates and new scenarios released during the term.
- The support response target for the tier.

## What it does not cover

- Ownership of the software. A licence is not a transfer of copyright.
- Third-party material. MITRE ATT&CK content remains subject to the ATT&CK
  Terms of Use and the OWASP Top 10 to CC BY-SA 4.0; see [NOTICE](NOTICE).
- Any warranty beyond what is stated in the signed agreement.
- Professional services - custom scenario authoring, integration work and
  instructor training are separate engagements.

## Things to settle before selling to an institution

Listed here so they are not discovered during a procurement review:

- **Data protection.** Singapore's PDPA applies, a significant share of users
  are minors, and the institution will most likely be the data controller with
  the licensor as processor. That relationship needs a written agreement.
- **Data residency.** Ask early. Some institutions require data to remain in a
  particular jurisdiction, which is a hosting decision, not a contract clause.
- **Retention and erasure.** The platform implements an audited erasure path
  (`app.purge_student_data`), but the retention *policy* is a commercial and
  legal decision that has not been made.
- **Accessibility.** Public-sector buyers frequently require a conformance
  statement. The platform is built to WCAG 2.1 AA and has not been
  independently audited against it; say so rather than claiming conformance.
- **Availability.** Any uptime commitment has to be backed by the hosting
  arrangement actually in place.
- **Liability and insurance.** Standard for education contracts, and worth
  getting advice on before the first negotiation rather than during it.

## Contact

[LICENSOR NAME]
[CONTACT EMAIL]
[WEBSITE]
