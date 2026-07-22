import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { ErrorState } from "../components/EmptyState";

// Wave 2: render docs/roadmap.md incl. Mermaid blocks live with mermaid.js —
// see docs/plans/2026-07-22-wiki-ticket-ui-ia.md panel 3.
export default function Roadmap() {
  const roadmap = useApi(() => api.getRoadmap(), []);

  return (
    <Panel title="Roadmap">
      <p className="text-sm text-slate-400">Coming in wave 2.</p>
      <div className="mt-4">
        {roadmap.status === "loading" && <Spinner label="Loading /api/roadmap…" />}
        {roadmap.status === "error" && <ErrorState message={roadmap.error} />}
        {roadmap.status === "ok" && (
          <p className="text-sm text-slate-300">
            /api/roadmap wired — {roadmap.data.markdown.length} markdown chars,{" "}
            {Object.keys(roadmap.data.meta).length} frontmatter keys.
          </p>
        )}
      </div>
    </Panel>
  );
}
