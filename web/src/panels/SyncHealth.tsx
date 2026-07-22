import { useMemo } from "react";
import { api, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import StatCard from "../components/StatCard";
import Badge from "../components/Badge";
import { ErrorState, EmptyState } from "../components/EmptyState";
import type { WorklogItem } from "../lib/types";

// Wave 2: sync-state.json cursors + per-item push state joined against fold
// output; orphans/_conflicts surfaced loudly — see plan panel 8.

const OPEN_STATUSES = new Set(["todo", "in_progress", "blocked"]);

function isOpen(item: WorklogItem): boolean {
  return OPEN_STATUSES.has(item.status);
}

function externalLabel(item: WorklogItem): string | undefined {
  const ext = item.external;
  if (!ext) return undefined;
  if (typeof ext === "string") return ext;
  return ext.url ?? (ext.number != null ? `#${ext.number}` : ext.system);
}

export default function SyncHealth() {
  const sync = useApi(
    () =>
      api.getSync().catch((err) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
    [],
  );
  const items = useApi(() => api.getItems(), []);

  const openItems = useMemo(
    () => (items.status === "ok" ? items.data.filter(isOpen) : []),
    [items],
  );
  const pushed = openItems.filter((i) => Boolean(i.external));
  const unpushed = openItems.filter((i) => !i.external);

  const flagged = useMemo(
    () => (items.status === "ok" ? items.data.filter((i) => i._orphan || (i._conflicts && i._conflicts.length > 0)) : []),
    [items],
  );

  const cursors = sync.status === "ok" && sync.data?.cursors ? Object.entries(sync.data.cursors) : [];
  const stateConflicts = sync.status === "ok" && sync.data?._conflicts ? sync.data._conflicts : [];

  return (
    <Panel title="Sync health">
      {(sync.status === "loading" || items.status === "loading") && <Spinner label="Loading sync state…" />}
      {sync.status === "error" && <ErrorState message={sync.error} />}
      {items.status === "error" && <ErrorState message={items.error} />}

      {sync.status === "ok" && sync.data === null && (
        <EmptyState title="Sync never run" detail=".work/sync-state.json not found — no push/pull has happened yet." />
      )}

      {sync.status === "ok" && sync.data !== null && items.status === "ok" && (
        <div className="flex h-full min-h-0 flex-col gap-4">
          {(flagged.length > 0 || stateConflicts.length > 0) && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              <p className="font-semibold">
                {flagged.length + stateConflicts.length} item{flagged.length + stateConflicts.length === 1 ? "" : "s"}{" "}
                {flagged.length + stateConflicts.length === 1 ? "needs" : "need"} attention: orphans or unresolved
                merge conflicts
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs">
                {flagged.map((i) => (
                  <li key={i.id}>
                    <span className="font-mono">{i.id}</span> — {i.title}
                    {i._orphan && " (orphan)"}
                    {i._conflicts && i._conflicts.length > 0 && ` (conflicts: ${i._conflicts.join(", ")})`}
                  </li>
                ))}
                {stateConflicts.map((c, idx) => (
                  <li key={`sc-${idx}`}>{JSON.stringify(c)}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Open items" value={openItems.length} />
            <StatCard label="Linked to GitHub" value={pushed.length} />
            <StatCard label="Unpushed" value={unpushed.length} />
          </div>

          {cursors.length > 0 && (
            <div className="glass rounded-lg p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Sync cursors</p>
              <dl className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                {cursors.map(([k, v]) => (
                  <div key={k}>
                    <dt className="inline font-mono text-slate-400">{k}: </dt>
                    <dd className="inline text-slate-300">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto">
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Unpushed open items</p>
            {unpushed.length === 0 ? (
              <EmptyState title="All open items are linked" detail="Every open item has a GitHub issue." />
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-slate-950/90 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Item</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Title</th>
                  </tr>
                </thead>
                <tbody>
                  {unpushed.map((i) => (
                    <tr key={i.id} className="border-t border-slate-800/80">
                      <td className="px-2 py-2 font-mono text-xs text-slate-500">{i.id}</td>
                      <td className="px-2 py-2"><Badge axis="status" value={i.status} /></td>
                      <td className="px-2 py-2 text-slate-200">{i.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {pushed.length > 0 && (
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer text-slate-500">
                {pushed.length} open item{pushed.length === 1 ? "" : "s"} already linked to GitHub
              </summary>
              <ul className="mt-1.5 space-y-0.5 pl-4">
                {pushed.map((i) => (
                  <li key={i.id}>
                    <span className="font-mono">{i.id}</span> — {i.title}
                    {externalLabel(i) && <span className="text-slate-600"> ({externalLabel(i)})</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Panel>
  );
}
