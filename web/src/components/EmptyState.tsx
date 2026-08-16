interface EmptyStateProps {
  title: string;
  detail?: string;
}

export function EmptyState({ title, detail }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-800 py-12 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {detail && <p className="max-w-md text-xs text-slate-500">{detail}</p>}
    </div>
  );
}

/** For panels backed by an endpoint that reported `{ offline: true }` (e.g. releases). */
export function OfflineState({ detail }: { detail?: string }) {
  return (
    <EmptyState
      title="Offline — no gh CLI or network"
      detail={detail ?? "This panel needs GitHub access. File-based panels still work fully offline."}
    />
  );
}

export function isNoRepoError(message: string): boolean {
  return /worklog|no repo selected/i.test(message);
}

export function NoRepoState({ detail }: { detail?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-800 py-12 text-center">
      <p className="text-sm font-medium text-slate-300">No worklog repo</p>
      <p className="max-w-md text-xs text-slate-500">
        This session needs a WikiTicket SDD folder (a repo with <code>.work/config.yml</code>).
        Choose one with the Repo button.
      </p>
      <button
        type="button"
        className="focus-ring rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800/60"
        onClick={() => window.dispatchEvent(new Event("wiki-ticket:open-repo"))}
      >
        Choose repo
      </button>
      {detail && (
        <p className="max-w-md truncate text-[11px] text-slate-600" title={detail}>
          {detail}
        </p>
      )}
    </div>
  );
}

/** For a request that failed outright (network error, non-2xx, bad JSON). */
export function ErrorState({ message }: { message: string }) {
  if (isNoRepoError(message)) {
    return <NoRepoState detail={message} />;
  }
  return (
    <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}
