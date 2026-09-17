"use client";

import { useEffect, useState } from "react";

const FORMATS = {
  datetime: { dateStyle: "medium", timeStyle: "short" },
  time: { hour: "2-digit", minute: "2-digit", second: "2-digit" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

/**
 * A timestamp in the viewer's own time zone. The server renders on Vercel in
 * UTC, so formatting there would show a Singapore class the wrong hour; this
 * formats only after mounting in the browser.
 */
export function LocalTime({ iso, format = "datetime" }: { iso: string | null; format?: keyof typeof FORMATS }) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    setText(iso ? new Date(iso).toLocaleString([], FORMATS[format]) : null);
  }, [iso, format]);

  if (!iso) return <span>-</span>;
  return <time dateTime={iso}>{text ?? "…"}</time>;
}
