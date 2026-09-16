"use client";

import * as React from "react";
import { Search, Tag, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PHASE_LABELS } from "@/lib/events/types";
import type { TaggedIoc } from "@/lib/session/replay";
import type { iocTypeSchema } from "@/lib/content/schema";
import type { z } from "zod";

type IocType = z.infer<typeof iocTypeSchema>;

const IOC_TYPES: IocType[] = [
  "ip",
  "domain",
  "url",
  "hash",
  "email",
  "user",
  "host",
  "file",
  "registry",
  "process",
];

/**
 * Infers the indicator type from the value's shape so the student is not asked
 * to classify every tag by hand. They can still override it - the guess is a
 * convenience, and getting the type wrong is not what this scenario is
 * assessing.
 */
export function inferIocType(value: string): IocType {
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)) return "ip";
  if (/^[0-9a-f]{32}$|^[0-9a-f]{40}$|^[0-9a-f]{64}$/i.test(value)) return "hash";
  if (/^https?:\/\//i.test(value)) return "url";
  if (/^HK(LM|CU|CR|U|CC)\\/i.test(value)) return "registry";
  if (value.includes("@")) return "email";
  if (/\.(exe|dll|lnk|ps1|js|hta|docm|zip|iso|bat|vbs)$/i.test(value)) return "file";
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(value)) return "domain";
  if (/^[A-Z0-9-]+$/.test(value) && value.includes("-")) return "host";
  return "user";
}

/**
 * The evidence board.
 *
 * Whatever lands here becomes the IOC table in the generated report, so the
 * student is effectively writing part of their own deliverable while they
 * investigate rather than reconstructing it afterwards from memory.
 *
 * Note what it deliberately does not do: it gives no feedback on whether a tag
 * was correct. Colour-coding right and wrong here would turn investigation
 * into trial and error against the UI instead of against the evidence.
 */
export function IocBoard({
  tagged,
  disabled,
  onTag,
  onUntag,
  onPivot,
}: {
  tagged: TaggedIoc[];
  disabled?: boolean;
  onTag: (value: string, type: IocType, note?: string) => void;
  onUntag: (value: string) => void;
  onPivot: (value: string) => void;
}) {
  const [value, setValue] = React.useState("");
  const [type, setType] = React.useState<IocType>("domain");
  const [touchedType, setTouchedType] = React.useState(false);

  React.useEffect(() => {
    if (!touchedType && value.trim()) setType(inferIocType(value.trim()));
  }, [value, touchedType]);

  function add(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onTag(trimmed, type);
    setValue("");
    setTouchedType(false);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={add} className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste an indicator"
            aria-label="Indicator value"
            disabled={disabled}
            className="font-mono text-xs"
          />
          <Button type="submit" size="sm" disabled={disabled || !value.trim()}>
            <Tag className="size-3.5" />
            Tag
          </Button>
        </div>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v as IocType);
            setTouchedType(true);
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-xs" aria-label="Indicator type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {IOC_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="text-xs capitalize">
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </form>

      {tagged.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground">
          Nothing tagged yet. Expand a log entry or open a document and tag the values you believe
          belong to the attacker. Everything here goes into your report.
        </p>
      ) : (
        <ul className="space-y-1.5" aria-label="Tagged indicators">
          {tagged.map((ioc) => (
            <li
              key={ioc.value}
              className="group flex items-start gap-2 rounded-md border border-border p-2"
            >
              <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[0.625rem] capitalize">
                {ioc.ioc_type}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="break-all font-mono text-xs">{ioc.value}</p>
                <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                  Tagged during {PHASE_LABELS[ioc.phase]}
                </p>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  onClick={() => onPivot(ioc.value)}
                  aria-label={`Search the logs for ${ioc.value}`}
                  title="Search the logs for this value"
                >
                  <Search className="size-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  disabled={disabled}
                  onClick={() => onUntag(ioc.value)}
                  aria-label={`Remove ${ioc.value}`}
                  title="Remove this indicator"
                >
                  <X className="size-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[0.6875rem] text-muted-foreground">
        Removing a tag is recorded too. The log keeps the fact that you tagged it and then changed
        your mind, which is a normal and defensible thing for an analyst to do.
      </p>
    </div>
  );
}
