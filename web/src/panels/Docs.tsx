import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { ErrorState } from "../components/EmptyState";

// Wave 2: inventory-driven doc browser with truth-state badges + supersede
// chains from _inventory.json — see plan panel 6 (changed panel).
export default function Docs() {
  const docs = useApi(() => api.getDocs(), []);

  return (
    <Panel title="Docs">
      <p className="text-sm text-slate-400">Coming in wave 2.</p>
      <div className="mt-4">
        {docs.status === "loading" && <Spinner label="Loading /api/docs…" />}
        {docs.status === "error" && <ErrorState message={docs.error} />}
        {docs.status === "ok" && (
          <p className="text-sm text-slate-300">
            /api/docs wired — {docs.data.docs.length} doc{docs.data.docs.length === 1 ? "" : "s"} in
            the inventory.
          </p>
        )}
      </div>
    </Panel>
  );
}
