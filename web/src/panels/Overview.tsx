import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { ErrorState } from "../components/EmptyState";

// Wave 2: headline stats, milestone progress rings, activity sparkline —
// see docs/plans/2026-07-22-wiki-ticket-ui-ia.md panel 1.
export default function Overview() {
  const items = useApi(() => api.getItems(), []);

  return (
    <Panel title="Overview">
      <p className="text-sm text-slate-400">Coming in wave 2.</p>
      <div className="mt-4">
        {items.status === "loading" && <Spinner label="Loading /api/items…" />}
        {items.status === "error" && <ErrorState message={items.error} />}
        {items.status === "ok" && (
          <p className="text-sm text-slate-300">
            /api/items wired — {items.data.length} item{items.data.length === 1 ? "" : "s"} loaded.
          </p>
        )}
      </div>
    </Panel>
  );
}
