import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { ErrorState } from "../components/EmptyState";

// Wave 2: join publish-manifest.json + .work/published.json + live re-hash
// into green/amber/red 3-way drift — see plan panel 7 (renamed from Wiki,
// changed panel). Primary endpoint here is /api/index/manifest (what SHOULD
// be published); /api/wiki-ledger already computes drift server-side.
export default function PublishPlane() {
  const manifest = useApi(() => api.getManifest(), []);

  return (
    <Panel title="Publish plane">
      <p className="text-sm text-slate-400">Coming in wave 2.</p>
      <div className="mt-4">
        {manifest.status === "loading" && <Spinner label="Loading /api/index/manifest…" />}
        {manifest.status === "error" && <ErrorState message={manifest.error} />}
        {manifest.status === "ok" && (
          <p className="text-sm text-slate-300">
            /api/index/manifest wired — {manifest.data.pages.length} page
            {manifest.data.pages.length === 1 ? "" : "s"} in the publish manifest.
          </p>
        )}
      </div>
    </Panel>
  );
}
