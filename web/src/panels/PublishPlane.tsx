import { useMemo } from "react";
import { api, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import Badge from "../components/Badge";
import StatCard from "../components/StatCard";
import { ErrorState, EmptyState } from "../components/EmptyState";
import type { WikiDrift, WikiLedgerEntry } from "../lib/types";

// Wave 2: .work/published.json joined with a computed 3-way drift, straight
// from /api/wiki-ledger — see plan panel 7 (renamed from Wiki, changed
// panel). Mirrors the wiki-publish skill's two-hash rules:
//   - in-sync: render_hash matches what's published.
//   - pending: render_hash differs but the frozen source itself is intact
//     (e.g. a truth banner flipped) — needs a republish, not a human.
//   - source-drift: a FROZEN page's source_hash no longer matches the
//     committed source — someone edited a frozen doc after publish. This is
//     an integrity violation: a human has to look, republish can't fix it.

const DRIFT_LABEL: Record<WikiDrift, string> = {
  "in-sync": "in-sync",
  pending: "pending republish",
  "source-drift": "SOURCE DRIFT",
  unknown: "unknown",
};

const DRIFT_DOT: Record<WikiDrift, string> = {
  "in-sync": "bg-emerald-400",
  pending: "bg-amber-400",
  "source-drift": "bg-red-500",
  unknown: "bg-slate-500",
};

export default function PublishPlane() {
  const ledger = useApi(
    () =>
      api.getWikiLedger().catch((err) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
    [],
  );

  // The ledger's own record key is the one guaranteed-unique identifier —
  // some older published.json entries (predating the IA work) have no
  // wiki_key field at all, so `entry.wiki_key` alone isn't safe as a React
  // key or a display fallback.
  const entries: (WikiLedgerEntry & { ledgerKey: string })[] = useMemo(() => {
    if (ledger.status !== "ok" || !ledger.data) return [];
    return Object.entries(ledger.data).map(([ledgerKey, entry]) => ({ ...entry, ledgerKey }));
  }, [ledger]);

  const counts = useMemo(() => {
    const c: Record<WikiDrift, number> = { "in-sync": 0, pending: 0, "source-drift": 0, unknown: 0 };
    for (const e of entries) c[e.drift] = (c[e.drift] ?? 0) + 1;
    return c;
  }, [entries]);

  return (
    <Panel title="Publish plane">
      {ledger.status === "loading" && <Spinner label="Loading /api/wiki-ledger…" />}
      {ledger.status === "error" && <ErrorState message={ledger.error} />}
      {ledger.status === "ok" && ledger.data === null && (
        <EmptyState title="Nothing published yet" detail=".work/published.json not found — no wiki-publish run yet." />
      )}
      {ledger.status === "ok" && ledger.data && (
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="In sync" value={counts["in-sync"]} />
            <StatCard label="Pending republish" value={counts.pending} />
            <StatCard label="Source drift" value={counts["source-drift"]} />
            <StatCard label="Unknown" value={counts.unknown} />
          </div>

          {entries.length === 0 ? (
            <EmptyState title="Ledger is empty" />
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-slate-950/90 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Page</th>
                    <th className="px-2 py-2">wiki_key</th>
                    <th className="px-2 py-2">Truth state</th>
                    <th className="px-2 py-2">Drift</th>
                    <th className="px-2 py-2">Wiki</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr
                      key={e.ledgerKey}
                      className={`border-t border-slate-800/80 ${
                        e.drift === "source-drift" ? "bg-red-950/30" : ""
                      }`}
                    >
                      <td className="px-2 py-2 text-slate-200">{e.title}</td>
                      <td className="px-2 py-2 font-mono text-xs text-slate-400">{e.wiki_key ?? e.ledgerKey}</td>
                      <td className="px-2 py-2">
                        {e.truth_state && <Badge axis="truth_state" value={e.truth_state} />}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className="inline-flex items-center gap-1.5"
                          title={
                            e.drift === "source-drift"
                              ? "Frozen source was edited after publish — an integrity violation. Republishing alone will not fix this; a human needs to reconcile the source."
                              : e.drift === "pending"
                                ? "Rendered content changed (e.g. a truth banner) but the source is intact — safe to republish."
                                : undefined
                          }
                        >
                          <span className={`h-2 w-2 rounded-full ${DRIFT_DOT[e.drift]}`} />
                          <span
                            className={
                              e.drift === "source-drift" ? "font-semibold text-red-300" : "text-slate-300"
                            }
                          >
                            {DRIFT_LABEL[e.drift]}
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noreferrer"
                          className="focus-ring rounded text-accent hover:underline"
                        >
                          open ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
