import { useEffect, useState } from "react";
import type { RepoInfo } from "../lib/types";
import { api, isTauri } from "../lib/api";
import { getRecentRepos, rememberRepo } from "../lib/recentRepos";
import LocalRootsPanel from "./LocalRootsPanel";
import GithubRepoPanel from "./GithubRepoPanel";

type Tab = "recent" | "local" | "github";

interface RepoPickerModalProps {
  repo: RepoInfo | null;
  onClose: () => void;
}

/**
 * Browser: the server binds to one repo per process (`--repo` at launch) —
 * this modal displays the active repo and keeps a localStorage history of
 * paths for the next launch (it does not switch repos live).
 *
 * Tauri: native folder dialog / clickable recent list call pick_repo /
 * set_repo, then reload so every panel remounts against the new repo.
 */
export default function RepoPickerModal({ repo, onClose }: RepoPickerModalProps) {
  const [recent, setRecent] = useState<string[]>(getRecentRepos());
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("recent");
  const tauri = isTauri();

  useEffect(() => {
    if (repo?.repo_path) setRecent(rememberRepo(repo.repo_path));
  }, [repo?.repo_path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function addDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setRecent(rememberRepo(trimmed));
    setDraft("");
  }

  async function selectPath(path: string) {
    if (!tauri) return;
    setBusy(true);
    setError(null);
    try {
      const info = await api.setRepo(path);
      rememberRepo(info.repo_path);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function chooseFolder() {
    if (!tauri) return;
    setBusy(true);
    setError(null);
    try {
      const info = await api.pickRepo();
      rememberRepo(info.repo_path);
      window.location.reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // User cancelled the native dialog — not an error worth red-bannering.
      if (!/cancell?ed/i.test(msg)) {
        setError(msg);
      }
      setBusy(false);
    }
  }

  function handleCloned(info: RepoInfo) {
    rememberRepo(info.repo_path);
    window.location.reload();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 pt-24"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repo-picker-title"
      onClick={onClose}
    >
      <div
        className="glass w-full max-w-md rounded-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="repo-picker-title" className="text-sm font-semibold text-slate-100">Repo</h2>
        <p className="mt-1 text-xs text-slate-500">
          {tauri ? (
            <>
              Choose a worklog repo folder (must contain{" "}
              <code className="text-slate-400">.work/config.yml</code>). Switching
              reloads the app against the new target.
            </>
          ) : (
            <>
              Active repo is set at server launch (
              <code className="text-slate-400">--repo</code>). This picker
              remembers paths for your next launch — it does not switch repos
              live.
            </>
          )}
        </p>

        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
          <span className="text-slate-500">Current: </span>
          <span className="text-slate-200">{repo?.repo_path ?? "none selected"}</span>
        </div>

        {error && (
          <p className="mt-2 rounded border border-red-800/50 bg-red-500/10 px-2 py-1.5 text-xs text-red-300">
            {error}
          </p>
        )}

        {tauri && (
          <button
            onClick={chooseFolder}
            disabled={busy}
            className="focus-ring mt-3 w-full rounded-lg bg-accent/15 px-3 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
          >
            {busy ? "Working…" : "Choose folder…"}
          </button>
        )}

        {tauri && (
          <div className="mt-4 flex gap-1 rounded-lg border border-slate-800 bg-slate-900/40 p-1 text-xs">
            {(["recent", "local", "github"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 rounded px-2 py-1 capitalize transition-colors ${
                  tab === t ? "bg-accent/20 text-accent" : "text-slate-400 hover:bg-slate-800/60"
                }`}
              >
                {t === "github" ? "GitHub" : t}
              </button>
            ))}
          </div>
        )}

        {(!tauri || tab === "recent") && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Recent</p>
            <ul className="mt-1 max-h-40 space-y-1 overflow-auto">
              {recent.length === 0 && (
                <li className="text-xs text-slate-600">No history yet.</li>
              )}
              {recent.map((path) => (
                <li key={path}>
                  {tauri ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => selectPath(path)}
                      className="w-full truncate rounded px-2 py-1 text-left text-xs text-slate-300 hover:bg-slate-800/60 disabled:opacity-50"
                      title={path}
                    >
                      {path}
                    </button>
                  ) : (
                    <span className="block truncate rounded px-2 py-1 text-xs text-slate-300">
                      {path}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tauri && tab === "local" && <LocalRootsPanel onSelect={selectPath} busy={busy} />}
        {tauri && tab === "github" && <GithubRepoPanel onCloned={handleCloned} />}

        {!tauri && (
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
        )}

        <button
          onClick={onClose}
          className="focus-ring mt-4 w-full rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/60"
        >
          Close
        </button>
      </div>
    </div>
  );
}
