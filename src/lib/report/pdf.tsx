import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { PHASE_LABELS } from "@/lib/events/types";
import { formatDuration, formatUtc } from "@/lib/utils";
import type { ReportModel } from "./build";

/**
 * The exported incident report.
 *
 * Rendered with @react-pdf/renderer rather than a headless browser so it works
 * in a serverless function with no Chromium to install and no cold-start
 * penalty measured in seconds.
 *
 * Styling is deliberately printable: black on white, no dark theme, no
 * background fills that eat a school printer's toner. This document gets
 * emailed to a moderator and put in a folder.
 */

const COLORS = {
  ink: "#16181d",
  muted: "#5d636e",
  line: "#d8dbe0",
  accent: "#0f6f7a",
  bad: "#9d2d28",
  good: "#1f6b43",
  wash: "#f4f5f7",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: COLORS.ink,
    lineHeight: 1.5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
    paddingBottom: 8,
    marginBottom: 14,
  },
  brand: { fontSize: 13, fontFamily: "Helvetica-Bold", color: COLORS.accent },
  brandSub: { fontSize: 7.5, color: COLORS.muted, marginTop: 2 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 9, color: COLORS.muted, marginBottom: 14 },

  banner: {
    backgroundColor: COLORS.wash,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    padding: 8,
    marginBottom: 14,
    fontSize: 8,
    color: COLORS.muted,
  },

  section: { marginTop: 14, marginBottom: 6 },
  h2: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    paddingBottom: 3,
    marginBottom: 7,
  },
  h3: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 3 },
  body: { marginBottom: 5 },
  muted: { color: COLORS.muted },
  mono: { fontFamily: "Courier", fontSize: 8 },

  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLORS.line, paddingVertical: 3 },
  headRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ink,
    paddingVertical: 3,
  },
  cellHead: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  cell: { fontSize: 8, paddingRight: 6 },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  metaItem: { width: "50%", flexDirection: "row", paddingVertical: 1.5 },
  metaLabel: { width: 108, color: COLORS.muted, fontSize: 8 },
  metaValue: { flex: 1, fontSize: 8 },

  scoreBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: COLORS.wash,
    padding: 10,
    marginTop: 6,
  },
  scoreFigure: { fontSize: 20, fontFamily: "Helvetica-Bold", color: COLORS.accent },

  pill: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 1.5,
    paddingHorizontal: 4,
    marginRight: 4,
    marginBottom: 3,
  },

  integrityOk: { borderLeftWidth: 3, borderLeftColor: COLORS.good, paddingLeft: 8, paddingVertical: 4 },
  integrityBad: { borderLeftWidth: 3, borderLeftColor: COLORS.bad, paddingLeft: 8, paddingVertical: 4 },

  commentBox: {
    borderWidth: 0.5,
    borderColor: COLORS.line,
    height: 74,
    marginTop: 4,
    padding: 6,
  },

  footer: {
    position: "absolute",
    bottom: 26,
    left: 44,
    right: 44,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.line,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLORS.muted,
  },
});

function Table({
  headers,
  widths,
  rows,
}: {
  headers: string[];
  widths: string[];
  rows: (string | { text: string; color?: string })[][];
}) {
  if (rows.length === 0) {
    return <Text style={[styles.body, styles.muted]}>None recorded.</Text>;
  }

  return (
    <View>
      <View style={styles.headRow} fixed>
        {headers.map((header, i) => (
          <Text key={header} style={[styles.cellHead, { width: widths[i] }]}>
            {header}
          </Text>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row} wrap={false}>
          {row.map((cell, i) => {
            const value = typeof cell === "string" ? cell : cell.text;
            const color = typeof cell === "string" ? undefined : cell.color;
            return (
              <Text key={i} style={[styles.cell, { width: widths[i] }, color ? { color } : {}]}>
                {value}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

export function IncidentReportDocument({ model }: { model: ReportModel }) {
  const g = model.grade;

  return (
    <Document
      title={`Incident Report - ${model.scenario.title}`}
      author="NocturneAnalysis"
      subject={`Synthetic SOC training exercise completed by ${model.analyst_handle}`}
      creator="NocturneAnalysis"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.brand}>NocturneAnalysis</Text>
            <Text style={styles.brandSub}>SOC analyst training - incident report</Text>
          </View>
          <View>
            <Text style={[styles.mono, { textAlign: "right", color: COLORS.muted }]}>
              {model.session_id.slice(0, 8).toUpperCase()}
            </Text>
            <Text style={[styles.brandSub, { textAlign: "right" }]}>
              {formatUtc(model.generated_at)}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{model.scenario.title}</Text>
        <Text style={styles.subtitle}>
          Prepared by {model.analyst_handle} &middot; {model.organization_name}
        </Text>

        <Text style={styles.banner}>
          This report documents a training exercise. All data in it is synthetic: no real systems,
          networks, organisations or people are involved, addresses are drawn from IETF
          documentation ranges and hostnames use reserved TLDs that cannot resolve.
        </Text>

        {/* ------------------------------------------------------ details */}
        <View style={styles.section}>
          <Text style={styles.h2}>Report details</Text>
          <View style={styles.metaGrid}>
            <Meta label="Analyst" value={model.analyst_handle} />
            <Meta label="Organisation" value={model.organization_name} />
            <Meta label="Scenario" value={`${model.scenario.title}`} />
            <Meta
              label="Category"
              value={`${model.scenario.category} (${model.scenario.difficulty})`}
            />
            <Meta label="Affected entity" value={model.scenario.organization} />
            <Meta label="Started" value={formatUtc(model.started_at ?? "")} />
            <Meta
              label="Completed"
              value={model.completed_at ? formatUtc(model.completed_at) : "In progress"}
            />
            <Meta label="Time on incident" value={formatDuration(model.duration_ms)} />
            <Meta
              label="Time to containment"
              value={
                model.time_to_contain_ms === null
                  ? "Not contained"
                  : formatDuration(model.time_to_contain_ms)
              }
            />
            <Meta label="Events recorded" value={String(model.event_count)} />
          </View>

          <View style={styles.scoreBox}>
            <View>
              <Text style={styles.muted}>Overall score</Text>
              <Text style={styles.scoreFigure}>
                {g.score} / {g.max_score}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.muted}>{g.percentage}%</Text>
              <Text style={{ fontSize: 8 }}>
                {g.mitre.matched.length}/{model.techniques.length} techniques identified
              </Text>
              <Text style={{ fontSize: 8 }}>
                {model.iocs.filter((i) => i.status === "correct").length} indicators found,{" "}
                {model.iocs.filter((i) => i.status === "false_positive").length} false positives
              </Text>
            </View>
          </View>
        </View>

        {/* ---------------------------------------------------- integrity */}
        <View style={styles.section}>
          <Text style={styles.h2}>Evidence integrity</Text>
          <View style={model.integrity.valid ? styles.integrityOk : styles.integrityBad}>
            {model.integrity.valid ? (
              <>
                <Text style={{ fontFamily: "Helvetica-Bold", color: COLORS.good }}>
                  Verified - chain intact
                </Text>
                <Text style={styles.body}>
                  All {model.integrity.length} events form an unbroken SHA-256 chain. Each digest
                  covers the previous digest, the event payload, its server-assigned timestamp and
                  its type, so any insertion, deletion, reordering or edit breaks the chain at that
                  point. Timestamps are assigned by the server; the browser cannot set them.
                </Text>
                <Text style={styles.mono}>head {model.integrity.headHash}</Text>
              </>
            ) : (
              <>
                <Text style={{ fontFamily: "Helvetica-Bold", color: COLORS.bad }}>
                  Failed verification
                </Text>
                <Text style={styles.body}>{model.integrity.reason}</Text>
                <Text style={styles.body}>
                  The failure is at event {(model.integrity.brokenAtIndex ?? 0) + 1}. Treat the
                  findings below as unconfirmed until the cause is established.
                </Text>
              </>
            )}
          </View>
        </View>

        {/* --------------------------------------------- executive summary */}
        <View style={styles.section}>
          <Text style={styles.h2}>Executive summary</Text>
          <Text style={styles.body}>{model.executive_summary}</Text>
          <Text style={styles.h3}>Root cause</Text>
          <Text style={styles.body}>{model.scenario.root_cause}</Text>
        </View>

        {/* ---------------------------------------------------- timeline */}
        <View style={styles.section} break>
          <Text style={styles.h2}>Timeline of analyst actions</Text>
          <Text style={[styles.body, styles.muted]}>
            Reconstructed by replaying the session&apos;s event log in order.
          </Text>
          <Table
            headers={["Time (UTC)", "Phase", "Action", "Detail"]}
            widths={["19%", "14%", "20%", "47%"]}
            rows={model.timeline.map((row) => [
              formatUtc(row.at),
              row.phase ? PHASE_LABELS[row.phase] : "-",
              row.action,
              row.detail,
            ])}
          />

          <Text style={styles.h3}>Time per phase</Text>
          <Table
            headers={["Phase", "Duration"]}
            widths={["50%", "50%"]}
            rows={model.phase_durations.map((p) => [
              p.label,
              p.duration_ms === null ? "Not reached" : formatDuration(p.duration_ms),
            ])}
          />
        </View>

        {/* -------------------------------------------------------- IOCs */}
        <View style={styles.section} break>
          <Text style={styles.h2}>Indicators of compromise</Text>
          <Table
            headers={["Indicator", "Type", "Status", "Notes"]}
            widths={["31%", "10%", "14%", "45%"]}
            rows={model.iocs.map((ioc) => [
              ioc.value,
              ioc.ioc_type,
              {
                text:
                  ioc.status === "correct"
                    ? "Identified"
                    : ioc.status === "missed"
                      ? "Missed"
                      : "False positive",
                color:
                  ioc.status === "correct"
                    ? COLORS.good
                    : ioc.status === "missed"
                      ? COLORS.muted
                      : COLORS.bad,
              },
              ioc.description,
            ])}
          />
        </View>

        {/* ------------------------------------------------------- MITRE */}
        <View style={styles.section}>
          <Text style={styles.h2}>MITRE ATT&amp;CK coverage</Text>
          <Table
            headers={["Technique", "Name", "Tactic", "Identified"]}
            widths={["14%", "36%", "30%", "20%"]}
            rows={model.techniques.map((t) => [
              t.id,
              t.name,
              t.tactic,
              { text: t.matched ? "Yes" : "No", color: t.matched ? COLORS.good : COLORS.bad },
            ])}
          />
          {model.technique_false_positives.length > 0 ? (
            <Text style={[styles.body, { marginTop: 5, color: COLORS.bad }]}>
              Claimed without supporting evidence: {model.technique_false_positives.join(", ")}
            </Text>
          ) : null}
        </View>

        {/* ------------------------------------------------------- OWASP */}
        {model.owasp.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.h2}>OWASP Top 10 (2021) mapping</Text>
            <Table
              headers={["Category", "In plain language"]}
              widths={["34%", "66%"]}
              rows={model.owasp.map((c) => [c.name, c.plain_language])}
            />
          </View>
        ) : null}

        {/* --------------------------------------------------- decisions */}
        <View style={styles.section} break>
          <Text style={styles.h2}>Decisions recorded</Text>
          {g.decisions.map((decision) => (
            <View key={decision.decision_key} style={{ marginBottom: 8 }} wrap={false}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.5 }}>{decision.prompt}</Text>
              <Text style={styles.cell}>
                Answered: {decision.given_labels.join("; ") || "Not answered"}
              </Text>
              {decision.expected_labels.length > 0 ? (
                <Text style={styles.cell}>Expected: {decision.expected_labels.join("; ")}</Text>
              ) : null}
              <Text
                style={[
                  styles.cell,
                  {
                    color:
                      decision.correct === null
                        ? COLORS.muted
                        : decision.correct
                          ? COLORS.good
                          : COLORS.bad,
                  },
                ]}
              >
                {decision.correct === null
                  ? "Not machine-graded"
                  : decision.correct
                    ? "Correct"
                    : "Incorrect"}{" "}
                ({decision.points_earned}/{decision.points_possible} points) &middot;{" "}
                {PHASE_LABELS[decision.phase]}
              </Text>
              {decision.student_rationale ? (
                <Text style={[styles.cell, styles.muted]}>
                  Analyst&apos;s reasoning: {decision.student_rationale}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* --------------------------------------------- lessons learned */}
        <View style={styles.section} break>
          <Text style={styles.h2}>Lessons learned</Text>
          {model.reflection ? (
            <>
              <Text style={styles.h3}>What happened</Text>
              <Text style={styles.body}>{model.reflection.what_happened || "Not completed."}</Text>
              <Text style={styles.h3}>What worked</Text>
              <Text style={styles.body}>{model.reflection.what_worked || "Not completed."}</Text>
              <Text style={styles.h3}>What should change</Text>
              <Text style={styles.body}>{model.reflection.what_to_change || "Not completed."}</Text>
              <Text style={styles.h3}>Recommended controls</Text>
              {model.reflection.recommended_controls
                .filter((c) => c.trim())
                .map((control, i) => (
                  <Text key={i} style={styles.body}>
                    &bull; {control}
                  </Text>
                ))}
            </>
          ) : (
            <Text style={[styles.body, styles.muted]}>
              The post-incident review was not completed.
            </Text>
          )}

          <Text style={styles.h3}>Model recommendations for comparison</Text>
          {model.scenario.model_recommendations.map((recommendation, i) => (
            <Text key={i} style={styles.body}>
              &bull; {recommendation}
            </Text>
          ))}
        </View>

        {/* --------------------------------------------------- score box */}
        <View style={styles.section}>
          <Text style={styles.h2}>Score breakdown</Text>
          <Table
            headers={["Component", "Points"]}
            widths={["62%", "38%"]}
            rows={[
              [
                "Decisions",
                `${g.decisions.reduce((s, d) => s + Math.max(0, d.points_earned), 0)} / ${g.decisions.reduce((s, d) => s + d.points_possible, 0)}`,
              ],
              [
                "Response actions",
                `${g.actions.reduce((s, a) => s + Math.max(0, a.points_earned), 0)} / ${g.actions.reduce((s, a) => s + a.points_possible, 0)}`,
              ],
              [
                "Indicators identified",
                String(g.iocs.filter((i) => i.status === "correct").reduce((s, i) => s + i.points, 0)),
              ],
              [
                "Post-incident review",
                `${g.reflection.points_earned} / ${g.reflection.points_possible}`,
              ],
              ["Hints used", `-${g.hint_penalty}`],
              ["False positives and incorrect actions", `-${g.false_positive_penalty}`],
              ["Total", `${g.score} / ${g.max_score} (${g.percentage}%)`],
            ]}
          />

          {g.badges.length > 0 ? (
            <>
              <Text style={styles.h3}>Badges earned</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {g.badges.map((badge) => (
                  <Text
                    key={badge}
                    style={[styles.pill, { backgroundColor: COLORS.wash, color: COLORS.accent }]}
                  >
                    {badge.replace(/_/g, " ")}
                  </Text>
                ))}
              </View>
            </>
          ) : null}
        </View>

        {/* ------------------------------------------------- instructor */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.h2}>Instructor comments</Text>
          {model.instructor_comments.length === 0 ? (
            <>
              <Text style={[styles.body, styles.muted]}>
                No comments recorded. Space is left below for written feedback.
              </Text>
              <View style={styles.commentBox} />
            </>
          ) : (
            model.instructor_comments.map((comment, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>
                  {comment.instructor_handle} &middot; {formatUtc(comment.created_at)}
                </Text>
                <Text style={styles.body}>{comment.comment}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>
            NocturneAnalysis &middot; synthetic training data &middot; MITRE ATT&amp;CK&reg; is a
            registered trademark of The MITRE Corporation
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
