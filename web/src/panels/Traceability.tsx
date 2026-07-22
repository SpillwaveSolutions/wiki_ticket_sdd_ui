import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { EmptyState, ErrorState } from "../components/EmptyState";
import type { GraphEdgeType, GraphNode } from "../lib/types";
import {
  computeNeighborhood,
  edgeTypesInGraph,
  groupByKind,
  nodeLabel,
  parseTraceCheck,
  pushBreadcrumb,
  type NeighborNode,
} from "./traceability-graph";

// Wave 2 (new panel, the IA dividend): interactive _graph.json explorer —
// pick a node, walk plan -> items -> tickets -> PRs -> release both
// directions, plus trace-check integrity checklist. See plan's "New panel".
//
// Graph BFS / breadcrumb / trace-check parsing live in traceability-graph.ts
// as pure functions (unit tested there); this file is rendering + local UI
// state only.

const KIND_ICON: Record<string, string> = {
  plan: "\u{1F4CB}", // clipboard
  item: "\u{1F9E9}", // puzzle piece
  ticket: "\u{1F3AB}", // ticket
  release: "\u{1F680}", // rocket
  adr: "\u{1F4D0}", // triangular ruler
  design: "\u{1F5BC}️", // framed picture
  guide: "\u{1F4D8}", // blue book
  roadmap: "\u{1F5FA}️", // map
  "roadmap-snapshot": "\u{1F5FA}️",
  status: "\u{1F4CA}", // bar chart
};

function kindIcon(kind?: string): string {
  return KIND_ICON[kind ?? ""] ?? "❓"; // question mark fallback
}

function metaLine(node: GraphNode): string {
  if (typeof node.status === "string") return `status: ${node.status}`;
  if (node.truth_state) return `truth: ${node.truth_state}`;
  if (typeof node.source === "string") return node.source;
  if (typeof node.url === "string") return node.url;
  return "";
}

function matchesQuery(id: string, node: GraphNode | undefined, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return id.toLowerCase().includes(q) || (node?.title ?? "").toLowerCase().includes(q);
}

interface NodeCardProps {
  id: string;
  node: GraphNode | null;
  via?: { edgeType: GraphEdgeType; direction: "up" | "down" };
  onClick?: () => void;
}

function NodeCard({ id, node, via, onClick }: NodeCardProps) {
  const label = nodeLabel(id, node);
  const kind = node?.doc_type;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="w-full rounded-lg border border-slate-800 bg-slate-900/40 p-2 text-left transition hover:border-accent/50 hover:bg-slate-900/70 disabled:cursor-default"
    >
      <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-500">
        <span aria-hidden>{kindIcon(kind)}</span>
        <span>{kind ?? "unknown"}</span>
        {!node && (
          <span className="ml-auto text-red-400" title="Referenced by an edge but missing from the graph's nodes map">
            dangling
          </span>
        )}
      </span>
      <span className="block truncate text-sm text-slate-100" title={label}>
        {label}
      </span>
      {node && metaLine(node) && (
        <span className="block truncate text-[11px] text-slate-500">{metaLine(node)}</span>
      )}
      {via && (
        <span className="mt-1 block text-[10px] text-accent">
          {via.direction === "up" ? `${via.edgeType} →` : `→ ${via.edgeType}`}
        </span>
      )}
    </button>
  );
}

function Column({
  title,
  items,
  direction,
  onSelect,
}: {
  title: string;
  items: NeighborNode[];
  direction: "up" | "down";
  onSelect: (id: string) => void;
}) {
  return (
    <div className="w-56 shrink-0">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-600">—</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <NodeCard id={n.id} node={n.node} via={{ edgeType: n.viaType, direction }} onClick={() => onSelect(n.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Traceability() {
  const graph = useApi(() => api.getGraph(), []);
  const traceCheck = useApi(() => api.getTraceCheck(), []);
  const [searchParams, setSearchParams] = useSearchParams();

  const [focusId, setFocusId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<GraphEdgeType>>(new Set());

  // Deep link: seed focus from ?node=<id> once the graph has loaded, falling
  // back to the first node id. Runs once (guarded by focusId) so the URL
  // doesn't fight the user's later clicks.
  useEffect(() => {
    if (graph.status !== "ok" || focusId) return;
    const nodes = graph.data.nodes;
    const fromUrl = searchParams.get("node");
    const initial = fromUrl && nodes[fromUrl] ? fromUrl : (Object.keys(nodes).sort()[0] ?? null);
    if (initial) setFocusId(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.status]);

  function focusOn(id: string) {
    if (id === focusId) return;
    setBreadcrumb((trail) => (focusId ? pushBreadcrumb(trail, focusId) : trail));
    setFocusId(id);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("node", id);
        return next;
      },
      { replace: true },
    );
  }

  function jumpToBreadcrumb(index: number) {
    const target = breadcrumb[index];
    if (!target) return;
    setBreadcrumb((trail) => trail.slice(0, index));
    setFocusId(target);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("node", target);
        return next;
      },
      { replace: true },
    );
  }

  function toggleEdgeType(type: GraphEdgeType) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const nodes = graph.status === "ok" ? graph.data.nodes : undefined;
  const edges = graph.status === "ok" ? graph.data.edges : undefined;

  const kindGroups = useMemo(() => (nodes ? groupByKind(nodes) : []), [nodes]);
  const edgeTypes = useMemo(() => (edges ? edgeTypesInGraph(edges) : []), [edges]);
  const neighborhood = useMemo(
    () => (nodes && edges && focusId ? computeNeighborhood(nodes, edges, focusId, hiddenTypes) : null),
    [nodes, edges, focusId, hiddenTypes],
  );
  const traceParsed = useMemo(
    () => (traceCheck.status === "ok" ? parseTraceCheck(traceCheck.data.output) : null),
    [traceCheck.status, traceCheck.data],
  );

  return (
    <Panel title="Traceability">
      {graph.status === "loading" && <Spinner label="Loading /api/index/graph…" />}
      {graph.status === "error" && <ErrorState message={graph.error} />}
      {graph.status === "ok" && nodes && edges && (
        <div className="flex h-full min-h-0 flex-col gap-4">
          <div className="flex min-h-0 flex-1 gap-4">
            <div className="flex w-64 shrink-0 flex-col gap-1 overflow-y-auto rounded-lg border border-slate-800 p-2">
              <input
                type="search"
                placeholder="Search nodes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search nodes"
                className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent focus:outline-none"
              />
              {kindGroups.map((group) => {
                const ids = group.ids.filter((id) => matchesQuery(id, nodes[id], query));
                if (ids.length === 0) return null;
                return (
                  <div key={group.kind}>
                    <p className="mt-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <span>
                        {kindIcon(group.kind)} {group.kind}
                      </span>
                      <span>{ids.length}</span>
                    </p>
                    <ul>
                      {ids.map((id) => (
                        <li key={id}>
                          <button
                            type="button"
                            onClick={() => focusOn(id)}
                            title={id}
                            className={`w-full truncate rounded px-1.5 py-1 text-left text-xs ${
                              id === focusId ? "bg-accent/20 text-accent" : "text-slate-300 hover:bg-slate-800"
                            }`}
                          >
                            {nodeLabel(id, nodes[id])}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3">
              {breadcrumb.length > 0 && (
                <nav className="flex flex-wrap items-center gap-1 text-xs text-slate-400" aria-label="Breadcrumb">
                  {breadcrumb.map((id, i) => (
                    <span key={`${id}-${i}`} className="flex items-center gap-1">
                      <button type="button" onClick={() => jumpToBreadcrumb(i)} className="text-accent hover:underline">
                        {nodeLabel(id, nodes[id] ?? null)}
                      </button>
                      <span>/</span>
                    </span>
                  ))}
                  <span className="text-slate-200">{focusId ? nodeLabel(focusId, nodes[focusId] ?? null) : ""}</span>
                </nav>
              )}

              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Edge type filter">
                {edgeTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleEdgeType(type)}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      hiddenTypes.has(type) ? "border-slate-800 text-slate-600 line-through" : "border-accent/40 text-accent"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {neighborhood && focusId ? (
                <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
                  <Column
                    title="Upstream · 2 hops"
                    items={neighborhood.upstream.filter((n) => n.hop === 2)}
                    direction="up"
                    onSelect={focusOn}
                  />
                  <Column
                    title="Upstream · 1 hop"
                    items={neighborhood.upstream.filter((n) => n.hop === 1)}
                    direction="up"
                    onSelect={focusOn}
                  />
                  <div className="w-56 shrink-0">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent">Focus</p>
                    <NodeCard id={focusId} node={nodes[focusId] ?? null} />
                  </div>
                  <Column
                    title="Downstream · 1 hop"
                    items={neighborhood.downstream.filter((n) => n.hop === 1)}
                    direction="down"
                    onSelect={focusOn}
                  />
                  <Column
                    title="Downstream · 2 hops"
                    items={neighborhood.downstream.filter((n) => n.hop === 2)}
                    direction="down"
                    onSelect={focusOn}
                  />
                </div>
              ) : (
                <EmptyState title="No node selected" />
              )}
            </div>
          </div>

          <div className="shrink-0 rounded-lg border border-slate-800 p-3">
            <h2 className="mb-2 text-sm font-semibold text-slate-200">Integrity checklist (trace-check)</h2>
            {traceCheck.status === "loading" && <Spinner label="Loading /api/trace-check…" />}
            {traceCheck.status === "error" && <ErrorState message={traceCheck.error} />}
            {traceParsed &&
              (traceParsed.clean ? (
                <p className="flex items-center gap-2 text-sm text-emerald-300">
                  <span aria-hidden>✅</span> {traceParsed.summary}
                </p>
              ) : (
                <div>
                  <p className="mb-1 flex items-center gap-2 text-sm text-red-300">
                    <span aria-hidden>❌</span> {traceParsed.summary || "unlinked evidence found"}
                  </p>
                  <ul className="max-h-40 overflow-y-auto text-xs text-slate-400">
                    {traceParsed.gaps.map((gap, i) => (
                      <li key={i} className="border-t border-slate-800/60 py-0.5 first:border-t-0">
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
