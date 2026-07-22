import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { ErrorState, OfflineState } from "../components/EmptyState";

// Wave 2: GitHub releases timeline linked to snapshot roadmap + design doc
// pairs via truth_state/snapshot-of edges — see plan panel 5 (changed panel).
export default function Releases() {
  const releases = useApi(() => api.getReleases(), []);

  return (
    <Panel title="Releases">
      <p className="text-sm text-slate-400">Coming in wave 2.</p>
      <div className="mt-4">
        {releases.status === "loading" && <Spinner label="Loading /api/releases…" />}
        {releases.status === "error" && <ErrorState message={releases.error} />}
        {releases.status === "ok" && releases.data.offline && <OfflineState />}
        {releases.status === "ok" && !releases.data.offline && (
          <p className="text-sm text-slate-300">
            /api/releases wired — {releases.data.releases.length} release
            {releases.data.releases.length === 1 ? "" : "s"} loaded.
          </p>
        )}
      </div>
    </Panel>
  );
}
