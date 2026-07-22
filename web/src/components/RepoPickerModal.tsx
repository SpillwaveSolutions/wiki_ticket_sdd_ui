import { useEffect, useState } from "react";
import type { RepoInfo } from "../lib/types";
import { getRecentRepos, rememberRepo } from "../lib/recentRepos";

interface RepoPickerModalProps {
  repo: RepoInfo | null;
  onClose: () => void;
}

/**
 * The server binds to one repo per process (`--repo` at launch) — this modal
 * can't switch repos live. It displays the active repo and keeps a
 * localStorage history of paths you've pointed the app at, for the dev
 * workflow: relaunch the server with a different --repo.
 */
export default function RepoPickerModal({ repo, onClose }: RepoPickerModalProps) {
  const [recent, setRecent] = useState<string[]>(getRecentRepos());
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (repo?.repo_path) setRecent(rememberRepo(repo.repo_path));
  }, [repo?.repo_path]);

  function addDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setRecent(rememberRepo(trimmed));
    setDraft("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 pt-24"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-slate-100">Repo</h2>
        <p className="mt-1 text-xs text-slate-500">
          Active repo is set at server launch (<code className="text-slate-400">--repo</code>).
          This picker remembers paths for your next launch — it does not switch repos live.
        </p>

        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
          <span className="text-slate-500">Current: </span>
          <span className="text-slate-200">{repo?.repo_path ?? "unknown"}</span>
        </div>

        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Recent</p>
          <ul className="mt-1 max-h-40 space-y-1 overflow-auto">
            {recent.length === 0 && <li className="text-xs text-slate-600">No history yet.</li>}
            {recent.map((path) => (
              <li key={path} className="truncate rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-800/60">
                {path}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDraft()}
            placeholder="/path/to/another/worklog/repo"
            className="flex-1 rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-accent focus:outline-none"
          />
          <button
            onClick={addDraft}
            className="focus-ring rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800/60"
          >
            Remember
          </button>
        </div>

        <button
          onClick={onClose}
          className="focus-ring mt-4 w-full rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
        >
          Close
        </button>
      </div>
    </div>
  );
}
