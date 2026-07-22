// Pure graph/text logic for the Traceability panel — kept dependency-free and
// DOM-free so it's cheap to unit test. Traceability.tsx is the only caller.
import type { GraphEdge, GraphEdgeType, GraphNode } from "../lib/types";

export type NeighborDirection = "upstream" | "downstream";

export interface NeighborNode {
  id: string;
  /** null when the id is referenced by an edge but absent from the nodes map
   * (a dangling edge target/source) — render defensively, never crash. */
  node: GraphNode | null;
  hop: 1 | 2;
  viaType: GraphEdgeType;
  /** the node one hop closer to focus that this node was discovered through */
  viaId: string;
}

export interface Neighborhood {
  focus: string;
  upstream: NeighborNode[];
  downstream: NeighborNode[];
}

/**
 * BFS out to `maxDepth` hops from `startId`, following edges in `direction`
 * ("downstream" = edge.from -> edge.to away from focus; "upstream" = reverse).
 * Edges whose type is in `hiddenTypes` are skipped. Dangling edge endpoints
 * (ids not present in `nodes`) are still traversed (the id is real, just
 * undocumented) but surface with `node: null`.
 */
function bfs(
  nodes: Record<string, GraphNode>,
  edges: GraphEdge[],
  startId: string,
  direction: NeighborDirection,
  hiddenTypes: ReadonlySet<GraphEdgeType>,
  maxDepth: number,
): NeighborNode[] {
  const visited = new Set<string>([startId]);
  const result: NeighborNode[] = [];
  let frontier = [startId];

  for (let hop = 1; hop <= maxDepth && frontier.length > 0; hop++) {
    const frontierSet = new Set(frontier);
    const discovered = new Map<string, { viaType: GraphEdgeType; viaId: string }>();
    for (const edge of edges) {
      if (hiddenTypes.has(edge.type)) continue;
      const near = direction === "downstream" ? edge.from : edge.to;
      const far = direction === "downstream" ? edge.to : edge.from;
      if (!frontierSet.has(near) || visited.has(far) || discovered.has(far)) continue;
      discovered.set(far, { viaType: edge.type, viaId: near });
    }
    const next: string[] = [];
    for (const [id, via] of discovered) {
      visited.add(id);
      next.push(id);
      result.push({ id, node: nodes[id] ?? null, hop: hop as 1 | 2, viaType: via.viaType, viaId: via.viaId });
    }
    frontier = next;
  }
  return result;
}

/** Depth-2, both-directions neighborhood of `focusId`, honoring an edge-type filter. */
export function computeNeighborhood(
  nodes: Record<string, GraphNode>,
  edges: GraphEdge[],
  focusId: string,
  hiddenTypes: ReadonlySet<GraphEdgeType> = new Set(),
  maxDepth = 2,
): Neighborhood {
  return {
    focus: focusId,
    upstream: bfs(nodes, edges, focusId, "upstream", hiddenTypes, maxDepth),
    downstream: bfs(nodes, edges, focusId, "downstream", hiddenTypes, maxDepth),
  };
}

export interface KindGroup {
  kind: string;
  ids: string[];
}

/** Groups node ids by doc_type ("?" for missing), sorted kind then id, for the left rail. */
export function groupByKind(nodes: Record<string, GraphNode>): KindGroup[] {
  const byKind = new Map<string, string[]>();
  for (const id of Object.keys(nodes)) {
    const kind = nodes[id]?.doc_type ?? "?";
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind)!.push(id);
  }
  return [...byKind.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, ids]) => ({ kind, ids: ids.sort() }));
}

/** A human label for a node card: title if present, else the id's tail segment. */
export function nodeLabel(id: string, node: GraphNode | null): string {
  if (node?.title) return node.title;
  const tail = id.includes("/") ? id.slice(id.indexOf("/") + 1) : id;
  return tail;
}

/** All edge types actually present in the loaded graph, for the legend. */
export function edgeTypesInGraph(edges: GraphEdge[]): GraphEdgeType[] {
  return [...new Set(edges.map((e) => e.type))].sort();
}

/** Push a refocus onto a breadcrumb trail: dedupes immediate repeats, caps length. */
export function pushBreadcrumb(trail: string[], from: string, maxLen = 12): string[] {
  if (trail[trail.length - 1] === from) return trail;
  const next = [...trail, from];
  return next.length > maxLen ? next.slice(next.length - maxLen) : next;
}

export interface TraceCheckParsed {
  clean: boolean;
  gaps: string[];
  summary: string;
}

/**
 * Parses `bin/worklog trace-check` output. Clean output is exactly
 * "trace: no unlinked evidence"; dirty output is N gap lines followed by
 * "trace: N unlinked-evidence gap(s)". Defensive against empty/unexpected
 * output — never throws, reports not-clean with an explanatory summary.
 */
export function parseTraceCheck(output: string): TraceCheckParsed {
  const lines = output
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  const summary = lines.find((l) => l.startsWith("trace:")) ?? "";
  const gaps = lines.filter((l) => l !== summary && !l.startsWith("trace:"));
  if (!summary) {
    return { clean: false, gaps, summary: gaps.length ? "" : "no trace-check output" };
  }
  return { clean: summary.includes("no unlinked evidence"), gaps, summary };
}
