"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Activity, FileText, Radar, ScrollText, ShieldCheck, Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { AlertQueue } from "@/components/console/alert-queue";
import { LogViewer } from "@/components/console/log-viewer";
import { DocumentList, DocumentViewer } from "@/components/console/document-viewer";
import { CasePanel } from "@/components/console/case-panel";
import { IocBoard, inferIocType } from "@/components/console/ioc-board";
import { PhaseStepper } from "@/components/console/phase-stepper";
import { SessionTimeline } from "@/components/console/session-timeline";
import { TechniqueChip, OwaspChip } from "@/components/shared/chips";
import { useSessionLog } from "@/lib/console/use-session-log";
import { visibleAtPhase } from "@/lib/console/query";
import { evaluatePhaseGate } from "@/lib/grading/engine";
import { nextPhase, type PhaseKey, type SessionEvent } from "@/lib/events/types";
import type { SessionReflection } from "@/lib/events/payloads";
import type {
  ActionSpec,
  Alert,
  DocumentAsset,
  LogEntry,
  MitreTechnique,
  OwaspCategory,
  ScenarioBundle,
} from "@/lib/content/schema";
import { cn, formatDuration } from "@/lib/utils";

const EMPTY_REFLECTION: SessionReflection = {
  what_happened: "",
  what_worked: "",
  what_to_change: "",
  recommended_controls: [""],
};

/**
 * The SOC workbench.
 *
 * Three panes on a desktop - queue, evidence, case - collapsing to tabs on a
 * Chromebook or phone. Everything the student does here routes through
 * `append()`, which is the only path to the audit log, so the timeline tab is
 * literally the same data the report is built from.
 */
export function SocConsole({
  sessionId,
  startedAt,
  bundle,
  initialEvents,
  analystHandle,
  techniques,
  owasp,
}: {
  sessionId: string;
  startedAt: string;
  bundle: ScenarioBundle;
  initialEvents: SessionEvent[];
  analystHandle: string;
  techniques: MitreTechnique[];
  owasp: OwaspCategory[];
}) {
  const router = useRouter();
  const { scenario } = bundle;
  const { state, events, append, pendingCount } = useSessionLog(sessionId, initialEvents);

  const [selectedAlertId, setSelectedAlertId] = React.useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = React.useState<string | null>(null);
  const [pivotValue, setPivotValue] = React.useState<string | null>(null);
  const [reflection, setReflection] = React.useState<SessionReflection>(
    state.reflection ?? EMPTY_REFLECTION,
  );
  const [elapsed, setElapsed] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [mobileTab, setMobileTab] = React.useState("case");

  const phase = state.currentPhase;
  const phaseSpec = scenario.phases.find((p) => p.key === phase) ?? scenario.phases[0];
  const isLastPhase = phaseSpec.key === "lessons_learned";
  const gate = React.useMemo(
    () => evaluatePhaseGate(phaseSpec, state, bundle),
    [phaseSpec, state, bundle],
  );

  const techniqueById = React.useMemo(
    () => new Map(techniques.map((t) => [t.technique_id, t])),
    [techniques],
  );

  // The session opens with SESSION_START so the log always has a genesis event
  // and the elapsed clock has something to measure from.
  const startedRef = React.useRef(false);
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (initialEvents.length === 0) {
      void append("SESSION_START", "triage", {
        scenario_slug: scenario.slug,
        resumed: false,
      });
    } else {
      void append("SESSION_RESUME", state.currentPhase, {});
    }
    // Deliberately once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const tick = () => setElapsed(Date.now() - Date.parse(startedAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  /**
   * Alerts stream in rather than arriving all at once. `reveal_after_seconds`
   * is measured from the session's real start time, so a student who leaves
   * and comes back does not get a burst of stale "new" alerts.
   */
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const visibleAlerts: Alert[] = React.useMemo(() => {
    const secondsIn = (now - Date.parse(startedAt)) / 1000;
    return bundle.alerts.filter(
      (alert) => visibleAtPhase(alert, phase) && alert.reveal_after_seconds <= secondsIn,
    );
  }, [bundle.alerts, phase, now, startedAt]);

  const previousAlertCount = React.useRef(0);
  React.useEffect(() => {
    if (previousAlertCount.current > 0 && visibleAlerts.length > previousAlertCount.current) {
      const newest = visibleAlerts.at(-1);
      toast.info("New alert in the queue", { description: newest?.title });
    }
    previousAlertCount.current = visibleAlerts.length;
  }, [visibleAlerts]);

  const visibleLogs: LogEntry[] = React.useMemo(
    () => bundle.logs.filter((log) => visibleAtPhase(log, phase)),
    [bundle.logs, phase],
  );

  const visibleDocs: DocumentAsset[] = React.useMemo(
    () => bundle.documents.filter((doc) => visibleAtPhase(doc, phase)),
    [bundle.documents, phase],
  );

  const selectedDoc = visibleDocs.find((d) => d.id === selectedDocId) ?? null;
  const taggedValues = state.taggedIocs.map((i) => i.value);
  const busy = pendingCount > 0 || submitting;

  // ------------------------------------------------------------ handlers --

  function onSelectAlert(alert: Alert) {
    setSelectedAlertId(alert.id);
    void append("VIEW_ALERT", phase, { alert_id: alert.id, severity: alert.severity });

    const linkedDoc = alert.linked_document_ids[0];
    if (linkedDoc) {
      setSelectedDocId(linkedDoc);
      setMobileTab("evidence");
    }
  }

  function onRunQuery(query: string, resultCount: number) {
    if (!query.trim()) return;
    void append("RUN_QUERY", phase, { query, result_count: resultCount, filters: {} });
  }

  function onViewEntry(entry: LogEntry) {
    void append("VIEW_LOG_ENTRY", phase, { log_id: entry.id, source: entry.source });
  }

  function tagIoc(value: string, sourceLogId?: string) {
    if (taggedValues.includes(value)) {
      toast.info("Already on your evidence board", { description: value });
      return;
    }
    void append("TAG_IOC", phase, {
      value,
      ioc_type: inferIocType(value),
      source_log_id: sourceLogId,
    });
    toast.success("Tagged as an indicator", { description: value });
  }

  function onSubmitDecision(key: string, value: string | string[], rationale?: string) {
    void append("SUBMIT_DECISION", phase, {
      decision_key: key,
      decision_value: value,
      rationale,
    });
  }

  async function onPerformAction(action: ActionSpec) {
    await append(action.event_type, phase, {
      action_key: action.key,
      target: action.target,
    });
    toast.success("Action recorded", { description: action.label });
  }

  function onAdvance() {
    const next = nextPhase(phase);
    if (!next) return;
    void append("PHASE_TRANSITION", next, { from: phase, to: next });
    toast.success(`Moving to ${next.replace(/_/g, " ")}`);
    setMobileTab("case");
    window.scrollTo({ top: 0 });
  }

  async function onSubmitReport() {
    setSubmitting(true);
    try {
      const appended = await append("SUBMIT_REPORT", phase, {
        reflection,
        executive_summary: reflection.what_happened.slice(0, 600),
      });
      if (!appended) return;

      await append("SESSION_COMPLETE", phase, { total_phases: scenario.phases.length });

      const response = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        toast.error("The report could not be generated", {
          description: `${body.error ?? "Unknown error"}. Your session is saved - open it from your dashboard.`,
        });
        return;
      }

      router.push(`/console/${sessionId}/report`);
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------- view --

  const evidencePane = (
    <Tabs defaultValue="logs" className="flex h-full flex-col">
      <TabsList className="m-2 self-start">
        <TabsTrigger value="logs">
          <Terminal className="mr-1.5 size-3.5" />
          Logs
        </TabsTrigger>
        <TabsTrigger value="documents">
          <FileText className="mr-1.5 size-3.5" />
          Documents
        </TabsTrigger>
        <TabsTrigger value="timeline">
          <ScrollText className="mr-1.5 size-3.5" />
          Your log
        </TabsTrigger>
      </TabsList>

      <TabsContent value="logs" className="mt-0 min-h-0 flex-1">
        <LogViewer
          logs={visibleLogs}
          phase={phase}
          taggedValues={taggedValues}
          onRunQuery={onRunQuery}
          onViewEntry={onViewEntry}
          onTagValue={(value, entry) => tagIoc(value, entry.id)}
          focusValue={pivotValue}
        />
      </TabsContent>

      <TabsContent value="documents" className="mt-0 flex min-h-0 flex-1 flex-col">
        <DocumentList
          documents={visibleDocs}
          selectedId={selectedDocId}
          onSelect={(doc) => setSelectedDocId(doc.id)}
        />
        <div className="min-h-0 flex-1">
          <DocumentViewer document={selectedDoc} onTag={(value) => tagIoc(value)} />
        </div>
      </TabsContent>

      <TabsContent value="timeline" className="mt-0 min-h-0 flex-1">
        <SessionTimeline events={events} sessionId={sessionId} />
      </TabsContent>
    </Tabs>
  );

  const casePane = (
    <CasePanel
      phase={phaseSpec}
      gate={gate}
      state={state}
      reflection={reflection}
      isLastPhase={isLastPhase}
      busy={busy}
      onSubmitDecision={onSubmitDecision}
      onPerformAction={onPerformAction}
      onAddNote={(text) => void append("ADD_NOTE", phase, { text })}
      onRequestHint={(hintKey, cost) => void append("REQUEST_HINT", phase, { hint_key: hintKey, cost })}
      onAdvance={onAdvance}
      onReflectionChange={setReflection}
      onSubmitReport={onSubmitReport}
    />
  );

  const iocPane = (
    <div className="p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Evidence board
      </h3>
      <IocBoard
        tagged={state.taggedIocs}
        disabled={busy}
        onTag={(value) => tagIoc(value)}
        onUntag={(value) => void append("UNTAG_IOC", phase, { value })}
        onPivot={(value) => {
          setPivotValue(value);
          setMobileTab("evidence");
        }}
      />
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* ------------------------------------------------------ top bar */}
      <header className="shrink-0 border-b border-border">
        <div className="flex h-12 items-center gap-3 px-3">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 text-sm font-semibold">
            <Radar className="size-4 text-primary" aria-hidden />
            <span className="hidden sm:inline">NocturneAnalysis</span>
          </Link>

          <span className="hidden min-w-0 truncate text-sm text-muted-foreground lg:inline">
            {scenario.title}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <span
              className="flex items-center gap-1.5 font-mono text-xs tabular-nums text-muted-foreground"
              title="Time on this incident"
            >
              <Activity className="size-3.5" aria-hidden />
              {formatDuration(elapsed)}
            </span>

            <Badge variant="outline" className="hidden sm:inline-flex" title="Your pseudonym">
              {analystHandle}
            </Badge>

            <span
              className={cn(
                "flex items-center gap-1 text-[0.6875rem]",
                pendingCount > 0 ? "text-chart-3" : "text-muted-foreground",
              )}
              role="status"
              aria-live="polite"
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              {pendingCount > 0 ? "Recording…" : `${state.eventCount} events logged`}
            </span>

            <ThemeToggle />
          </div>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto border-t border-border px-3 py-1.5">
          <PhaseStepper currentPhase={phase} completedPhases={state.completedPhases} />
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {scenario.mitre_techniques.map((id) => (
              <TechniqueChip key={id} id={id} technique={techniqueById.get(id)} />
            ))}
            {owasp.map((category) => (
              <OwaspChip key={category.code} code={category.code} category={category} />
            ))}
          </div>
        </div>
      </header>

      {/* --------------------------------------------------- desktop */}
      <div className="hidden min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(240px,18rem)_minmax(0,1fr)_minmax(340px,26rem)]">
        <aside className="flex min-h-0 flex-col border-r border-border">
          <div className="min-h-0 flex-1">
            <AlertQueue
              alerts={visibleAlerts}
              selectedId={selectedAlertId}
              viewedIds={state.viewedAlertIds}
              onSelect={onSelectAlert}
            />
          </div>
          <div className="scrollbar-thin max-h-[45%] overflow-y-auto border-t border-border">
            {iocPane}
          </div>
        </aside>

        <section className="min-h-0 border-r border-border">{evidencePane}</section>

        <aside className="min-h-0 bg-card">{casePane}</aside>
      </div>

      {/* ---------------------------------------------------- compact */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <Tabs value={mobileTab} onValueChange={setMobileTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="m-2 self-center">
            <TabsTrigger value="queue">Queue</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="case">Case</TabsTrigger>
            <TabsTrigger value="iocs">IOCs</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-0 min-h-0 flex-1">
            <AlertQueue
              alerts={visibleAlerts}
              selectedId={selectedAlertId}
              viewedIds={state.viewedAlertIds}
              onSelect={onSelectAlert}
            />
          </TabsContent>
          <TabsContent value="evidence" className="mt-0 min-h-0 flex-1">
            {evidencePane}
          </TabsContent>
          <TabsContent value="case" className="mt-0 min-h-0 flex-1 bg-card">
            {casePane}
          </TabsContent>
          <TabsContent value="iocs" className="scrollbar-thin mt-0 min-h-0 flex-1 overflow-y-auto">
            {iocPane}
          </TabsContent>
        </Tabs>
      </div>

      <footer className="shrink-0 border-t border-border px-3 py-1 text-center text-[0.6875rem] text-muted-foreground">
        100% synthetic data &mdash; no real attacks, scans or external targets.{" "}
        <span className="hidden sm:inline">
          Every action on this screen is appended to a tamper-evident log.
        </span>
      </footer>
    </div>
  );
}
