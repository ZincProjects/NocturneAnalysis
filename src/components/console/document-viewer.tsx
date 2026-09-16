"use client";

import * as React from "react";
import { FileText, Info, Mail, Siren, Tag, Ticket } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatUtc } from "@/lib/utils";
import type { DocumentAsset } from "@/lib/content/schema";

/**
 * Renders scenario documents in a form that resembles the tool they would
 * really be read in: an email looks like an email, an EDR detection looks like
 * a detection with a process tree.
 *
 * The `analyst_notes` on each document are the scaffolding a beginner needs -
 * they point at *what* to notice (a failing SPF check, a double extension)
 * without saying what it means. They are shown collapsed by default so a
 * confident student can ignore them.
 */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  edr_alert: Siren,
  ticket: Ticket,
  ransom_note: FileText,
};

export function DocumentList({
  documents,
  selectedId,
  onSelect,
}: {
  documents: DocumentAsset[];
  selectedId: string | null;
  onSelect: (doc: DocumentAsset) => void;
}) {
  return (
    <ul className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-border p-2">
      {documents.map((doc) => {
        const Icon = ICONS[doc.asset_type] ?? FileText;
        return (
          <li key={doc.id}>
            <Button
              size="sm"
              variant={doc.id === selectedId ? "secondary" : "ghost"}
              className="h-7 shrink-0 gap-1.5 text-xs"
              onClick={() => onSelect(doc)}
            >
              <Icon className="size-3.5" />
              {doc.title.length > 46 ? `${doc.title.slice(0, 45)}…` : doc.title}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all">{children}</dd>
    </>
  );
}

function AnalystNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <details className="rounded-md border border-border bg-secondary/40 p-3 font-sans text-xs">
      <summary className="cursor-pointer font-medium">
        <Info className="mr-1 inline size-3.5 align-text-bottom" aria-hidden />
        What an experienced analyst would notice here ({notes.length})
      </summary>
      <ul className="mt-2 space-y-1.5 pl-4">
        {notes.map((note) => (
          <li key={note} className="list-disc text-muted-foreground">
            {note}
          </li>
        ))}
      </ul>
    </details>
  );
}

type Content = Record<string, unknown>;

function asString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function EmailDocument({ content, onTag }: { content: Content; onTag: (v: string) => void }) {
  const headers = (content.headers ?? {}) as Record<string, string>;
  const attachments = asArray<Record<string, unknown>>(content.attachments);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 border-b border-border p-3 font-mono text-xs">
          <Field label="From">
            <span className="font-sans">{asString(content.from_display)}</span>{" "}
            <button
              type="button"
              onClick={() => onTag(asString(content.from_address))}
              className="text-primary underline underline-offset-2"
              title="Tag this address as an indicator"
            >
              {asString(content.from_address)}
            </button>
          </Field>
          <Field label="To">{asString(content.to)}</Field>
          <Field label="Date">{formatUtc(asString(content.date))}</Field>
          <Field label="Subject">
            <span className="font-sans font-medium">{asString(content.subject)}</span>
          </Field>
        </dl>

        {attachments.length > 0 ? (
          <div className="border-b border-border p-3">
            <p className="mb-2 text-xs font-medium">Attachments</p>
            <ul className="space-y-1.5">
              {attachments.map((att) => (
                <li
                  key={asString(att.filename)}
                  className="flex flex-wrap items-center gap-2 font-mono text-xs"
                >
                  <FileText className="size-3.5 text-muted-foreground" aria-hidden />
                  <button
                    type="button"
                    onClick={() => onTag(asString(att.filename))}
                    className="text-primary underline underline-offset-2"
                  >
                    {asString(att.filename)}
                  </button>
                  <span className="text-muted-foreground">{asString(att.size_bytes)} bytes</span>
                  {att.sha256 ? (
                    <button
                      type="button"
                      onClick={() => onTag(asString(att.sha256))}
                      className="break-all text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      title="Tag this hash as an indicator"
                    >
                      sha256:{asString(att.sha256).slice(0, 24)}…
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <pre className="scrollbar-thin overflow-x-auto whitespace-pre-wrap p-3 font-sans text-sm">
          {asString(content.body_text)}
        </pre>
      </div>

      {Object.keys(headers).length > 0 ? (
        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-xs font-medium">
            Message headers ({Object.keys(headers).length})
          </summary>
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-[0.6875rem]">
            {Object.entries(headers).map(([key, value]) => (
              <Field key={key} label={key}>
                {value}
              </Field>
            ))}
          </dl>
        </details>
      ) : null}

      <AnalystNotes notes={asArray<string>(content.analyst_notes)} />
    </div>
  );
}

function EdrDocument({ content, onTag }: { content: Content; onTag: (v: string) => void }) {
  const tree = asArray<Record<string, unknown>>(content.process_tree);
  const fileEvents = asArray<Record<string, unknown>>(content.file_events);
  const registryEvents = asArray<Record<string, unknown>>(content.registry_events);

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-md border border-border p-3 font-mono text-xs">
        <Field label="Detection">{asString(content.detection_id)}</Field>
        <Field label="Rule">
          <span className="font-sans">{asString(content.rule_name)}</span>
        </Field>
        <Field label="Severity">{asString(content.severity)}</Field>
        <Field label="Confidence">{asString(content.confidence)}</Field>
        <Field label="Host">{asString(content.hostname)}</Field>
        <Field label="User">{asString(content.username)}</Field>
        <Field label="Detected">{formatUtc(asString(content.detected_at))}</Field>
      </dl>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Process tree
        </h4>
        <ol className="space-y-2">
          {tree.map((proc, index) => {
            const depth = Number(proc.depth ?? index);
            return (
              <li
                key={`${asString(proc.pid)}-${index}`}
                style={{ marginLeft: `${depth * 1.25}rem` }}
                className={cn(
                  "rounded-md border border-border p-2.5 font-mono text-xs",
                  proc.signed === false && "border-destructive/40 bg-destructive/5",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="px-1.5 py-0 text-[0.625rem]">
                    pid {asString(proc.pid)}
                  </Badge>
                  <span className="break-all">{asString(proc.image)}</span>
                  <Badge
                    variant={proc.signed === false ? "destructive" : "outline"}
                    className="px-1.5 py-0 text-[0.625rem]"
                  >
                    {proc.signed === false ? "unsigned" : "signed"}
                  </Badge>
                </div>
                <p className="mt-1.5 break-all text-muted-foreground">
                  {asString(proc.command_line)}
                </p>
                {proc.sha256 ? (
                  <button
                    type="button"
                    onClick={() => onTag(asString(proc.sha256))}
                    className="mt-1.5 break-all text-[0.6875rem] text-primary underline underline-offset-2"
                  >
                    sha256:{asString(proc.sha256)}
                  </button>
                ) : null}
                {proc.note ? (
                  <p className="mt-1.5 font-sans text-[0.6875rem] text-muted-foreground">
                    {asString(proc.note)}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      {content.decoded_command ? (
        <section className="rounded-md border border-chart-3/40 bg-chart-3/5 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Decoded command
          </h4>
          <pre className="scrollbar-thin mt-2 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs">
            {asString(content.decoded_command)}
          </pre>
          {content.decode_hint ? (
            <p className="mt-2 text-[0.6875rem] text-muted-foreground">
              {asString(content.decode_hint)}
            </p>
          ) : null}
        </section>
      ) : null}

      {fileEvents.length > 0 || registryEvents.length > 0 ? (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Endpoint changes
          </h4>
          <ul className="space-y-1.5 font-mono text-xs">
            {fileEvents.map((ev) => (
              <li key={asString(ev.path)} className="rounded border border-border p-2">
                <span className="text-muted-foreground">{formatUtc(asString(ev.at))} </span>
                <span>{asString(ev.operation)} </span>
                <span className="break-all">{asString(ev.path)}</span>
              </li>
            ))}
            {registryEvents.map((ev) => (
              <li key={asString(ev.key)} className="rounded border border-border p-2">
                <span className="text-muted-foreground">{formatUtc(asString(ev.at))} </span>
                <span>{asString(ev.operation)} </span>
                <button
                  type="button"
                  onClick={() => onTag(asString(ev.key))}
                  className="break-all text-primary underline underline-offset-2"
                >
                  {asString(ev.key)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TicketDocument({ content }: { content: Content }) {
  return (
    <div className="space-y-3 rounded-md border border-border p-3">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 font-mono text-xs">
        <Field label="Ticket">{asString(content.ticket_id)}</Field>
        <Field label="Opened">{formatUtc(asString(content.opened_at))}</Field>
        <Field label="By">{asString(content.opened_by)}</Field>
        <Field label="Channel">{asString(content.channel)}</Field>
      </dl>
      <p className="font-medium">{asString(content.subject)}</p>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{asString(content.body)}</p>
    </div>
  );
}

function RansomNoteDocument({ content }: { content: Content }) {
  return (
    <div className="space-y-3">
      <pre className="scrollbar-thin overflow-x-auto whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/5 p-4 font-mono text-xs">
        {asString(content.body_text ?? content.text)}
      </pre>
      <AnalystNotes notes={asArray<string>(content.analyst_notes)} />
    </div>
  );
}

function GenericDocument({ content }: { content: Content }) {
  return (
    <pre className="scrollbar-thin overflow-x-auto rounded-md border border-border p-3 font-mono text-xs">
      {JSON.stringify(content, null, 2)}
    </pre>
  );
}

export function DocumentViewer({
  document: doc,
  onTag,
}: {
  document: DocumentAsset | null;
  onTag: (value: string) => void;
}) {
  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Select a document above, or open an alert to jump to the evidence attached to it.
      </div>
    );
  }

  const content = doc.content as Content;

  return (
    <div className="scrollbar-thin h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">{doc.title}</h3>
        <Badge variant="outline" className="shrink-0 capitalize">
          {doc.asset_type.replace(/_/g, " ")}
        </Badge>
      </div>

      {doc.asset_type === "email" ? (
        <EmailDocument content={content} onTag={onTag} />
      ) : doc.asset_type === "edr_alert" ? (
        <EdrDocument content={content} onTag={onTag} />
      ) : doc.asset_type === "ticket" ? (
        <TicketDocument content={content} />
      ) : doc.asset_type === "ransom_note" ? (
        <RansomNoteDocument content={content} />
      ) : (
        <GenericDocument content={content} />
      )}

      <p className="mt-4 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
        <Tag className="size-3" aria-hidden />
        Underlined values can be tagged as indicators. Tagging something benign costs points.
      </p>
    </div>
  );
}
