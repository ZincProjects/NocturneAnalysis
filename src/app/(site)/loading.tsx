/**
 * Shown the moment a link is clicked, while the next page renders on the
 * server. Without a loading boundary Next.js keeps the old page on screen until
 * the new one is fully ready, which reads as the click having done nothing.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="h-7 w-64 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
      <div className="mt-8 h-64 animate-pulse rounded-lg border border-border bg-card" />
    </div>
  );
}
