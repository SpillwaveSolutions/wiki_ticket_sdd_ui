import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { ErrorState } from "../components/EmptyState";

// Wave 2: burnup, kind mix, velocity by week, unplanned ratio — driven by
// event ULID timestamps — see plan panel 9. recharts is pre-installed.
export default function Charts() {
  const events = useApi(() => api.getEvents(), []);

  return (
    <Panel title="Charts">
      <p className="text-sm text-slate-400">Coming in wave 2.</p>
      <div className="mt-4">
        {events.status === "loading" && <Spinner label="Loading /api/events…" />}
        {events.status === "error" && <ErrorState message={events.error} />}
        {events.status === "ok" && (
          <p className="text-sm text-slate-300">
            /api/events wired — {events.data.length} event{events.data.length === 1 ? "" : "s"} to
            chart.
          </p>
        )}
      </div>
    </Panel>
  );
}
