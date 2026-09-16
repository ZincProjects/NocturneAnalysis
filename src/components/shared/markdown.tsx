import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Renders authored scenario prose (briefings, phase instructions, decision
 * rationales) with typography that stays readable in both themes.
 *
 * Scenario content is version-controlled in this repo and reviewed by whoever
 * merges it, so it is trusted input. react-markdown does not render raw HTML
 * unless a plugin is added for it, and none is - so a future scenario written
 * by a third party still cannot inject markup.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("space-y-3 text-sm leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ ...props }) => <h2 className="text-xl font-semibold tracking-tight" {...props} />,
          h2: ({ ...props }) => (
            <h3 className="mt-5 text-base font-semibold tracking-tight" {...props} />
          ),
          h3: ({ ...props }) => <h4 className="mt-4 text-sm font-semibold" {...props} />,
          p: ({ ...props }) => <p className="text-muted-foreground" {...props} />,
          ul: ({ ...props }) => (
            <ul className="ml-5 list-disc space-y-1.5 text-muted-foreground" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="ml-5 list-decimal space-y-1.5 text-muted-foreground" {...props} />
          ),
          li: ({ ...props }) => <li className="pl-1" {...props} />,
          strong: ({ ...props }) => <strong className="font-semibold text-foreground" {...props} />,
          code: ({ ...props }) => (
            <code
              className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground"
              {...props}
            />
          ),
          pre: ({ ...props }) => (
            <pre
              className="scrollbar-thin overflow-x-auto rounded-md border border-border bg-secondary p-3 font-mono text-xs"
              {...props}
            />
          ),
          blockquote: ({ ...props }) => (
            <blockquote
              className="border-l-2 border-primary/60 pl-4 text-muted-foreground italic"
              {...props}
            />
          ),
          a: ({ ...props }) => (
            <a
              className="text-primary underline underline-offset-2"
              target="_blank"
              rel="noreferrer noopener"
              {...props}
            />
          ),
          table: ({ ...props }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" {...props} />
            </div>
          ),
          th: ({ ...props }) => (
            <th className="border border-border bg-secondary px-2 py-1 text-left font-medium" {...props} />
          ),
          td: ({ ...props }) => <td className="border border-border px-2 py-1 align-top" {...props} />,
          hr: () => <hr className="border-border" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
