import { PHASE_KEYS, PHASE_LABELS, PHASE_NIST_MAPPING } from "@/lib/events/types";

/**
 * SOC 101, the primer a student works through before their first incident.
 *
 * Written for someone with no security background at all - a Year 2 IT
 * diploma student who has heard the phrase "SOC analyst" and nothing more. The
 * tone is deliberately plain and the sections are short, because a wall of
 * definitions is exactly what this is meant to replace.
 *
 * It ends with a five-question check. Passing is not a gate: a student can skip
 * straight to a scenario. Completing it earns a badge and is visible to the
 * instructor, which is the right amount of pressure for something whose value
 * depends on the student actually wanting to understand it.
 */

export interface PrimerSection {
  key: string;
  title: string;
  lede: string;
  body_md: string;
}

export interface QuizOption {
  value: string;
  label: string;
}

export interface QuizQuestion {
  key: string;
  prompt: string;
  options: QuizOption[];
  answer: string;
  /** Shown after answering, whichever way they went. */
  explanation_md: string;
}

export const PRIMER_SECTIONS: PrimerSection[] = [
  {
    key: "what-is-a-soc",
    title: "What a SOC actually is",
    lede: "A room full of people reading logs, deciding what matters.",
    body_md: `
A **Security Operations Centre** is the team that watches an organisation's
systems for signs that something has gone wrong, and does something about it
when it has.

That is genuinely most of it. There is no bank of glowing world maps. There is
a queue of alerts, a set of tools for searching logs, and a group of people
deciding, one alert at a time, whether this is nothing or whether this is the
start of a bad week.

The work splits roughly into three tiers, and knowing which one you are in tells
you what your job is:

- **Tier 1** watches the queue. They triage: assess each alert quickly, close
  the noise, and escalate what is real. The skill is speed and consistency, and
  the pressure is volume - a busy SOC sees thousands of alerts a day.
- **Tier 2** investigates what Tier 1 escalates. They pivot through logs,
  establish what actually happened, and run the response. This is where most of
  the scenarios in this platform sit.
- **Tier 3** handles the hardest cases and builds what the other two use -
  detection rules, threat hunting, forensics.

**Escalation** is the handoff between them. A good escalation carries what you
found, what you think it means, and how confident you are. A bad one is a
forwarded alert with no assessment, which just moves the work.

Most people start at Tier 1. The scenarios here start you at Tier 1 and move
you to Tier 2 within the first ten minutes, which is roughly how it goes.
`.trim(),
  },
  {
    key: "lifecycle",
    title: "The incident response lifecycle",
    lede: "Six phases, in order, and you cannot skip the boring ones.",
    body_md: `
When something real is found, the response follows a defined sequence. The
standard reference is **NIST SP 800-61**, the US National Institute of Standards
and Technology's guide to computer security incident handling. Nearly every
organisation's process is a version of it.

This platform uses six phases:

${PHASE_KEYS.map(
  (phase, i) => `${i + 1}. **${PHASE_LABELS[phase]}** — NIST: ${PHASE_NIST_MAPPING[phase]}`,
).join("\n")}

The order is not administrative tidiness. Each phase depends on the one before:

- **Containing before you have investigated** means you contain the wrong
  things, miss what you did not look for, and often destroy the evidence you
  needed.
- **Recovering before you have eradicated** means restoring clean systems into
  a compromised environment. The ransomware scenario in this library exists
  largely to make that mistake expensive.
- **Skipping lessons learned** means the same incident happens again. This is
  the phase real teams skip most often, and it is mandatory here.

In this platform each phase is **gated**. You cannot move on until the minimum
work is genuinely done, and the checklist is always visible so the requirement
is never a mystery.
`.trim(),
  },
  {
    key: "triage",
    title: "Triage: severity is not confidence",
    lede: "Two questions that get confused constantly, and the cost of confusing them.",
    body_md: `
Triage is deciding how much attention an alert deserves, quickly, without
solving it. Two separate judgements go into it and beginners routinely collapse
them into one.

**Severity** asks: *if this is real, how bad is it?* That is about impact -
how many systems, how sensitive the data, how central the service.

**Confidence** asks: *how sure am I that it is real?* That is about evidence -
how many independent sources agree, how well the story holds together.

They are independent. A high-severity, low-confidence alert is usually worth
escalating anyway, because the downside of being wrong is large. A
low-severity, high-confidence alert often is not worth anyone's afternoon.

### Alert fatigue

A SOC analyst may see several thousand alerts in a shift, and the overwhelming
majority are nothing. This produces a predictable failure: after the four
hundredth false positive, the four hundred and first gets a two-second glance.

This is not carelessness. It is what happens to human attention under that
volume, and it is why the genuinely dangerous alert so often gets closed by
someone competent and tired. Good SOCs fight it with tuning, automation and
rotation. Good analysts fight it by having a consistent method rather than
relying on how alert they feel.

### False positives have a cost

Marking something malicious when it is not is not a harmless error. Block a
legitimate domain and you take a service down. Tag the wrong indicator and a
colleague spends a day chasing it. Flag a student's ordinary behaviour and it
can become a disciplinary matter.

In this platform, tagging a benign value as an indicator costs you points -
because in a real SOC it costs somebody their afternoon, and sometimes rather
more than that.
`.trim(),
  },
  {
    key: "evidence",
    title: "Evidence and chain of custody",
    lede: "Why this platform hashes everything you do.",
    body_md: `
If an incident ends up in front of a regulator, an insurer, a court or a
parent, someone will ask a hard question: **how do you know?**

Answering that requires evidence whose integrity you can demonstrate. Not "we
wrote it down", but "here is the record, and here is why it could not have been
altered since." That property is called **chain of custody**: an unbroken,
verifiable account of what was collected, when, by whom, and that nothing
changed in between.

### How this platform does it

Every meaningful action you take here becomes one row in an append-only log.
Each row carries a SHA-256 hash computed over:

- the hash of the **previous** event,
- the contents of this event,
- the timestamp the **server** assigned it, and
- the event type.

Because each hash covers the one before it, the rows form a chain. Change any
event after the fact and its hash no longer matches its contents. Remove one,
insert one, or reorder them, and the links stop connecting. Either way the
break is visible, and it points at exactly where it happened.

The database enforces this independently of the application: no role can UPDATE
or DELETE a row in that table. Not students, not instructors, not
administrators.

You can see this working. The console has a **Your log** tab showing every
event with its hash, and a **Verify chain** button that recomputes every digest
in your browser from the events themselves.

Timestamps come from the server, never your computer, for the same reason a
signed document is dated by the notary rather than by whoever brought it in.
`.trim(),
  },
  {
    key: "frameworks",
    title: "ATT&CK and the OWASP Top 10",
    lede: "Shared vocabulary, so findings mean the same thing to everyone.",
    body_md: `
Two catalogues appear throughout this platform. Both exist for the same reason:
so that "we saw a phishing thing" becomes something another team, in another
country, can act on.

### MITRE ATT&CK

**ATT&CK** is a catalogue of what attackers actually do, built from observed
real-world intrusions. It is organised in two layers:

- **Tactics** are goals: get in, run code, stay resident, steal credentials,
  move sideways, take the data, cause damage.
- **Techniques** are the specific ways of achieving a goal. \`T1566.001\` is
  spearphishing with an attachment; \`T1486\` is encrypting data for impact.

When you tag an incident with technique IDs you are saying something precise
and comparable. You will select techniques during the investigation phase of
every scenario, and your report shows which you identified and which you
missed.

One warning worth taking seriously: only select techniques you can point at
evidence for. Claiming techniques that were not in play is how threat
intelligence gets polluted, and the platform scores it against you.

### The OWASP Top 10

Where ATT&CK catalogues what attackers do, the **OWASP Top 10** catalogues what
goes wrong in the web applications they attack: injection, broken access
control, security misconfiguration, and so on.

It is the standard vocabulary for application security, and it applies to the
web scenario in this library. A student who can name the category a bug belongs
to can find the established fix for it, which is the entire point of having a
shared list.
`.trim(),
  },
];

export const QUIZ: QuizQuestion[] = [
  {
    key: "severity-confidence",
    prompt:
      "An alert shows a pattern that, if real, would mean an attacker has admin access to the student records system. You have one weak indicator and nothing corroborating it. How should you rate it?",
    options: [
      { value: "high-sev-low-conf", label: "High severity, low confidence" },
      { value: "low-sev-low-conf", label: "Low severity, low confidence" },
      { value: "high-sev-high-conf", label: "High severity, high confidence" },
      { value: "low-sev-high-conf", label: "Low severity, high confidence" },
    ],
    answer: "high-sev-low-conf",
    explanation_md: `
Severity is about impact if true, and admin access to student records is
serious. Confidence is about evidence, and one weak uncorroborated indicator is
not much.

The two move independently. A weak indicator does not make a serious scenario
less serious - it makes you less sure it is happening. That combination is
usually still worth escalating, precisely because the downside of being wrong
is large.
`.trim(),
  },
  {
    key: "lifecycle-order",
    prompt:
      "You have confirmed malware on a laptop and know which server it is talking to. What comes next?",
    options: [
      { value: "containment", label: "Containment - stop it doing more damage" },
      { value: "recovery", label: "Recovery - get the user working again" },
      { value: "lessons", label: "Lessons learned - write up what happened" },
      { value: "eradication", label: "Eradication - delete the malware" },
    ],
    answer: "containment",
    explanation_md: `
Containment. You have investigated enough to know what and where, so the next
step is to stop the bleeding - isolate the host, cut the channel, disable
affected accounts.

Eradication comes after: removing the malware while it still has a live
connection to its operator just tells them you are onto them. Recovery comes
after that. Lessons learned closes the incident.
`.trim(),
  },
  {
    key: "false-positive",
    prompt:
      "While investigating, you notice a domain appearing in thousands of proxy log entries around the time of the incident. What should you conclude?",
    options: [
      {
        value: "investigate-what-it-is",
        label: "Nothing yet - find out what the domain is before tagging it",
      },
      { value: "definitely-c2", label: "It is command-and-control infrastructure - tag and block it" },
      { value: "ignore-it", label: "High-volume domains are always benign - ignore it" },
      { value: "block-precaution", label: "Block it as a precaution and decide later" },
    ],
    answer: "investigate-what-it-is",
    explanation_md: `
Find out what it is. Frequency tells you nothing about intent - and in
practice, the most-seen values in any log set are almost always the most
legitimate ones, because they are the things everything uses.

In one of the scenarios here, a heavily-occurring domain is the institution's
own content delivery host. Blocking it "as a precaution" takes the staff portal
offline. Precautionary blocking is not free, and "I saw it a lot" is not
evidence.
`.trim(),
  },
  {
    key: "chain-of-custody",
    prompt:
      "Why does this platform compute each event's hash over the previous event's hash as well as its own contents?",
    options: [
      {
        value: "detect-any-alteration",
        label: "So that altering, removing, inserting or reordering any event breaks the chain visibly",
      },
      { value: "encrypt", label: "To encrypt the event log so nobody can read it" },
      { value: "compress", label: "To compress the log and save storage" },
      { value: "speed", label: "To make searching the log faster" },
    ],
    answer: "detect-any-alteration",
    explanation_md: `
To make tampering detectable. Each hash depends on the one before it, so the
events form a chain: alter one and its hash stops matching its contents; remove,
insert or reorder one and the links stop connecting.

Note what it is **not**. Hashing is not encryption - the log is perfectly
readable, and it is meant to be. It proves integrity, not secrecy. Those are
different security properties and confusing them is a common beginner mistake.
`.trim(),
  },
  {
    key: "attack-mapping",
    prompt:
      "You are mapping an incident to MITRE ATT&CK. You strongly suspect the attacker moved laterally over SMB, but you have no log entry showing it. What should you do?",
    options: [
      {
        value: "do-not-claim",
        label: "Do not map that technique; note the suspicion separately as a gap in visibility",
      },
      { value: "include-it", label: "Include it - your judgement as an analyst is evidence" },
      { value: "include-with-note", label: "Include it and add a note saying you are unsure" },
      { value: "map-everything", label: "Map every technique that could plausibly apply, to be thorough" },
    ],
    answer: "do-not-claim",
    explanation_md: `
Do not map it. ATT&CK mappings are assertions about what happened, and they get
aggregated into threat intelligence that other teams act on.

A suspicion you cannot evidence is still worth recording - as a suspicion, and
usually as a **visibility gap**: "we would not be able to see this if it had
happened" is itself an important finding, and often more useful than the
technique tag would have been.

Mapping everything plausible is the opposite of thorough. It makes the mapping
mean nothing.
`.trim(),
  },
];

export const QUIZ_PASS_MARK = 4;
