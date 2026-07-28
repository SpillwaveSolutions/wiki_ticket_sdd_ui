import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { LocalRepoCandidate } from "../lib/types";

interface LocalRootsPanelProps {
  onSelect: (path: string) => void;
  busy: boolean;
}

/**
 * Scans configured root directories (folders that contain many repo
 * checkouts, e.g. ~/src, ~/clients/<client>/src) for worklog-enabled repos.
 * Roots persist in ~/.config/wicked_ticket/config.json — app-level state,
 * distinct from any target repo's own .work/config.yml.
 */
export default function LocalRootsPanel({ onSelect, busy }: LocalRootsPanelProps) {
  const [roots, setRoots] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<LocalRepoCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [rootList, scanned] = await Promise.all([api.listRepoRoots(), api.scanLocalRepos()]);
      setRoots(rootList);
      setCandidates(scanned.filter((c) => c.worklog_enabled));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addRoot() {
    try {
      await api.pickRepoRoot();
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancell?ed/i.test(msg)) setError(msg);
    }
  }

  async function removeRoot(path: string) {
    try {
      await api.removeRepoRoot(path);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mt-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">Root directories</p>
      <ul className="mt-1 space-y-1">
        {roots.length === 0 && (
          <li className="text-xs text-slate-600">
            No roots configured yet — add a folder that contains several repo checkouts.
          </li>
        )}
        {roots.map((root) => (
          <li key={root} className="flex items-center justify-between rounded px-2 py-1 text-xs text-slate-300">
            <span className="truncate" title={root}>
              {root}
            </span>
            <button
              type="button"
              onClick={() => removeRoot(root)}
              className="ml-2 shrink-0 text-slate-500 hover:text-red-400"
              title="Remove root"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={addRoot}
        className="focus-ring mt-2 w-full rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800/60"
      >
        Add root directory…
      </button>

      {error && (
        <p className="mt-2 rounded border border-red-800/50 bg-red-500/10 px-2 py-1.5 text-xs text-red-300">
          {error}
        </p>
      )}

      <p className="mt-4 text-xs uppercase tracking-wide text-slate-500">Worklog repos found</p>
      <ul className="mt-1 max-h-40 space-y-1 overflow-auto">
        {loading && <li className="text-xs text-slate-600">Scanning…</li>}
        {!loading && candidates.length === 0 && (
          <li className="text-xs text-slate-600">No worklog-enabled repos found under the configured roots.</li>
        )}
        {candidates.map((c) => (
          <li key={c.path}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSelect(c.path)}
              className="w-full truncate rounded px-2 py-1 text-left text-xs text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
              title={c.path}
            >
              {c.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
