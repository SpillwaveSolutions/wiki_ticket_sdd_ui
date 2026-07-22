import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { ErrorState } from "../components/EmptyState";

// Wave 2: sync-state.json cursors + per-item push state joined against fold
// output; orphans/_conflicts surfaced loudly — see plan panel 8.
export default function SyncHealth() {
  const sync = useApi(() => api.getSync(), []);

  return (
    <Panel title="Sync health">
      <p className="text-sm text-slate-400">Coming in wave 2.</p>
      <div className="mt-4">
        {sync.status === "loading" && <Spinner label="Loading /api/sync…" />}
        {sync.status === "error" && <ErrorState message={sync.error} />}
        {sync.status === "ok" && (
          <p className="text-sm text-slate-300">
            /api/sync wired — {Object.keys(sync.data.items ?? {}).length} tracked item
            {Object.keys(sync.data.items ?? {}).length === 1 ? "" : "s"} in sync state.
          </p>
        )}
      </div>
    </Panel>
  );
}
