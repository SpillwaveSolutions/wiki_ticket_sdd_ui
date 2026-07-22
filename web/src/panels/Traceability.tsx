import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { ErrorState } from "../components/EmptyState";

// Wave 2 (new panel, the IA dividend): interactive _graph.json explorer —
// pick a node, walk plan -> items -> tickets -> PRs -> release both
// directions, plus trace-check integrity checklist. See plan's "New panel".
export default function Traceability() {
  const graph = useApi(() => api.getGraph(), []);

  return (
    <Panel title="Traceability">
      <p className="text-sm text-slate-400">Coming in wave 2.</p>
      <div className="mt-4">
        {graph.status === "loading" && <Spinner label="Loading /api/index/graph…" />}
        {graph.status === "error" && <ErrorState message={graph.error} />}
        {graph.status === "ok" && (
          <p className="text-sm text-slate-300">
            /api/index/graph wired — {Object.keys(graph.data.nodes).length} nodes,{" "}
            {graph.data.edges.length} edges.
          </p>
        )}
      </div>
    </Panel>
  );
}
