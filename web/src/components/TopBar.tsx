import { useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import Spinner from "./Spinner";
import RepoPickerModal from "./RepoPickerModal";

export default function TopBar() {
  const repoState = useApi(() => api.getRepo(), []);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <header className="glass flex items-center justify-between rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-wide text-accent">WikiTicket UI</span>
        {repoState.status === "loading" && <Spinner label="Loading repo…" />}
        {repoState.status === "error" && (
          <span className="text-xs text-red-400">repo: {repoState.error}</span>
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
        className="focus-ring rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800/60"
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
