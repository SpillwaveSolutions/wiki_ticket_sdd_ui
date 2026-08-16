import { useEffect, useState } from "react";
import { api, isTauri } from "../lib/api";
import { useApi } from "../lib/useApi";
import Spinner from "./Spinner";
import RepoPickerModal from "./RepoPickerModal";

export default function TopBar({ onOpenNav }: { onOpenNav?: () => void }) {
  const repoState = useApi(() => api.getRepo(), []);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Tauri first-launch: auto-open the picker when no repo is selected yet so
  // the user isn't left staring at red panel errors.
  useEffect(() => {
    if (!isTauri()) return;
    if (repoState.status !== "error") return;
    const msg = repoState.error ?? "";
    if (/no repo selected/i.test(msg) || /not a worklog repo/i.test(msg)) {
      setPickerOpen(true);
    }
  }, [repoState]);

  return (
    <header className="glass flex min-w-0 items-center justify-between gap-2 rounded-xl px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="focus-ring rounded-lg border border-slate-800 px-2 py-1.5 text-slate-300 md:hidden"
          aria-label="Open navigation"
          onClick={onOpenNav}
        >
          Menu
        </button>
        <span className="shrink-0 text-sm font-semibold tracking-wide text-accent">WikiTicket UI</span>
        {repoState.status === "loading" && <Spinner label="Loading repo…" />}
        {repoState.status === "error" && (
          <span className="min-w-0 truncate text-xs text-red-400">repo: {repoState.error}</span>
        )}
        {repoState.status === "ok" && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-medium text-slate-200">
              {repoState.data.name ?? repoState.data.key ?? "repo"}
            </span>
            {repoState.data.branch && (
              <span className="rounded border border-slate-800 px-1.5 py-0.5">
                {repoState.data.branch}
              </span>
            )}
            {repoState.data.latest_tag && (
              <span className="rounded border border-slate-800 px-1.5 py-0.5">
                {repoState.data.latest_tag}
              </span>
            )}
            {repoState.data.drift.dirty && (
              <span className="rounded border border-amber-700/50 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">
                dirty
              </span>
            )}
            {repoState.data.drift.version_skew && (
              <span className="rounded border border-red-700/50 bg-red-500/10 px-1.5 py-0.5 text-red-300">
                version skew
              </span>
            )}
          </div>
        )}
      </div>
      <button
        onClick={() => setPickerOpen(true)}
        className="focus-ring shrink-0 rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800/60"
      >
        Repo
      </button>
      {pickerOpen && (
        <RepoPickerModal
          repo={repoState.status === "ok" ? repoState.data : null}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </header>
  );
}
