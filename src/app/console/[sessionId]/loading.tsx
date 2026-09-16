/** Placeholder for the SOC console while the session and its event log load. */
export default function Loading() {
  return (
    <div className="flex h-dvh flex-col" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the console</span>
      <div className="h-12 animate-pulse border-b border-border bg-card" />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 lg:grid-cols-[18rem_minmax(0,1fr)_26rem]">
        <div className="hidden animate-pulse rounded-lg border border-border bg-card lg:block" />
        <div className="animate-pulse rounded-lg border border-border bg-card" />
        <div className="hidden animate-pulse rounded-lg border border-border bg-card lg:block" />
      </div>
    </div>
  );
}
