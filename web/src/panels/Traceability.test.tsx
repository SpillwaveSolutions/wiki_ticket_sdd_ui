import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Traceability from "./Traceability";
import {
  computeNeighborhood,
  edgeTypesInGraph,
  groupByKind,
  nodeLabel,
  parseTraceCheck,
  pushBreadcrumb,
} from "./traceability-graph";
import type { GraphEdge, GraphNode } from "../lib/types";

// Small fixture graph exercising every shape the panel has to handle:
// plan -> items -> ticket -> release, a supersedes edge, and a dangling
// edge target ("item/999" is referenced but has no node record).
const NODES: Record<string, GraphNode> = {
  "plan/a": { doc_type: "plan", title: "Plan A", truth_state: "current" },
  "plan/old": { doc_type: "plan", title: "Plan Old", truth_state: "superseded" },
  "item/1": { doc_type: "item", title: "Item 1", status: "done" },
  "item/2": { doc_type: "item", title: "Item 2", status: "todo" },
  "ticket/1": { doc_type: "ticket", url: "https://github.com/x/y/issues/1" },
  "release/v1": { doc_type: "release" },
};

const EDGES: GraphEdge[] = [
  { from: "plan/a", to: "item/1", type: "produces" },
  { from: "plan/a", to: "item/2", type: "produces" },
  { from: "plan/a", to: "plan/old", type: "supersedes" },
  { from: "item/1", to: "ticket/1", type: "references" },
  { from: "ticket/1", to: "release/v1", type: "targets" },
  { from: "item/1", to: "item/999", type: "belongs-to" }, // dangling — must not crash
];

describe("computeNeighborhood", () => {
  it("walks two hops both directions from the focus node", () => {
    const n = computeNeighborhood(NODES, EDGES, "item/1");
    expect(n.upstream.map((x) => x.id)).toEqual(["plan/a"]);
    expect(n.upstream[0].hop).toBe(1);
    expect(
      n.downstream
        .filter((x) => x.hop === 1)
        .map((x) => x.id)
        .sort(),
    ).toEqual(["item/999", "ticket/1"]);
    expect(n.downstream.filter((x) => x.hop === 2).map((x) => x.id)).toEqual(["release/v1"]);
  });

  it("handles a dangling edge target defensively (node: null, no crash)", () => {
    const n = computeNeighborhood(NODES, EDGES, "item/1");
    const dangling = n.downstream.find((x) => x.id === "item/999");
    expect(dangling).toBeDefined();
    expect(dangling?.node).toBeNull();
  });

  it("respects an edge-type filter — hidden types are not traversed, and downstream nodes only reachable through a hidden type disappear", () => {
    const n = computeNeighborhood(NODES, EDGES, "item/1", new Set(["references"]));
    expect(n.downstream.some((x) => x.id === "ticket/1")).toBe(false);
    expect(n.downstream.some((x) => x.id === "release/v1")).toBe(false);
    expect(n.downstream.some((x) => x.id === "item/999")).toBe(true);
  });

  it("returns empty arrays for a node with no edges (orphan)", () => {
    const nodes = { ...NODES, "item/orphan": { doc_type: "item", title: "Orphan" } };
    const n = computeNeighborhood(nodes, EDGES, "item/orphan");
    expect(n.upstream).toEqual([]);
    expect(n.downstream).toEqual([]);
  });
});

describe("groupByKind", () => {
  it("groups and sorts node ids by doc_type", () => {
    const groups = groupByKind(NODES);
    expect(groups.map((g) => g.kind)).toEqual(["item", "plan", "release", "ticket"]);
    expect(groups.find((g) => g.kind === "plan")?.ids).toEqual(["plan/a", "plan/old"]);
  });
});

describe("nodeLabel", () => {
  it("prefers the node title, falls back to the id tail, and handles a missing node", () => {
    expect(nodeLabel("plan/a", NODES["plan/a"])).toBe("Plan A");
    expect(nodeLabel("release/v1", null)).toBe("v1");
    expect(nodeLabel("standalone", null)).toBe("standalone");
  });
});

describe("edgeTypesInGraph", () => {
  it("returns the sorted set of distinct edge types", () => {
    expect(edgeTypesInGraph(EDGES)).toEqual(["belongs-to", "produces", "references", "supersedes", "targets"]);
  });
});

describe("pushBreadcrumb", () => {
  it("appends a new entry", () => {
    expect(pushBreadcrumb([], "a")).toEqual(["a"]);
  });
  it("dedupes an immediate repeat", () => {
    expect(pushBreadcrumb(["a"], "a")).toEqual(["a"]);
  });
  it("caps the trail length, dropping the oldest entries", () => {
    expect(pushBreadcrumb(["a", "b"], "c", 2)).toEqual(["b", "c"]);
  });
});

describe("parseTraceCheck", () => {
  it("recognizes clean output", () => {
    const parsed = parseTraceCheck("trace: no unlinked evidence\n");
    expect(parsed.clean).toBe(true);
    expect(parsed.gaps).toEqual([]);
  });

  it("parses dirty output into gap lines + summary", () => {
    const parsed = parseTraceCheck(
      "01ABC (closed): no plan link\n01DEF (closed): no external ticket\ntrace: 2 unlinked-evidence gap(s)\n",
    );
    expect(parsed.clean).toBe(false);
    expect(parsed.gaps).toEqual(["01ABC (closed): no plan link", "01DEF (closed): no external ticket"]);
    expect(parsed.summary).toBe("trace: 2 unlinked-evidence gap(s)");
  });

  it("never crashes on empty output", () => {
    const parsed = parseTraceCheck("");
    expect(parsed.clean).toBe(false);
    expect(parsed.gaps).toEqual([]);
  });
});

function stubFetch(traceOutput: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/index/graph") {
        return new Response(JSON.stringify({ version: 1, nodes: NODES, edges: EDGES }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "/api/trace-check") {
        return new Response(JSON.stringify({ ok: true, output: traceOutput }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
}

describe("Traceability panel", () => {
  it("refocuses on a clicked neighbor and records a breadcrumb for the previous focus", async () => {
    stubFetch("trace: no unlinked evidence\n");
    render(
      <MemoryRouter initialEntries={["/traceability"]}>
        <Traceability />
      </MemoryRouter>,
    );

    // Default focus is the alphabetically-first node id ("item/1").
    await screen.findByTitle("Item 1");

    fireEvent.click(screen.getByTitle("Plan A"));

    await waitFor(() => expect(screen.getByTitle("Plan A")).toBeInTheDocument());
    const breadcrumbNav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumbNav).getByRole("button", { name: "Item 1" })).toBeInTheDocument();
    // Plan A's downstream neighborhood is now rendered.
    expect(await screen.findByTitle("Plan Old")).toBeInTheDocument();
  });

  it("renders a clean trace-check result", async () => {
    stubFetch("trace: no unlinked evidence\n");
    render(
      <MemoryRouter initialEntries={["/traceability"]}>
        <Traceability />
      </MemoryRouter>,
    );
    const summary = await screen.findByText("trace: no unlinked evidence");
    const checklist = summary.closest("div") as HTMLElement;
    expect(within(checklist).queryAllByRole("listitem")).toHaveLength(0);
  });

  it("renders a dirty trace-check result as a gap checklist", async () => {
    stubFetch("01ABC (closed): no plan link\ntrace: 1 unlinked-evidence gap(s)\n");
    render(
      <MemoryRouter initialEntries={["/traceability"]}>
        <Traceability />
      </MemoryRouter>,
    );
    expect(await screen.findByText("trace: 1 unlinked-evidence gap(s)")).toBeInTheDocument();
    expect(screen.getByText("01ABC (closed): no plan link")).toBeInTheDocument();
  });
  it("shows ia-index guidance when the graph is missing (404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "not found: _graph.json" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(
      <MemoryRouter initialEntries={["/traceability"]}>
        <Traceability />
      </MemoryRouter>,
    );
    expect(await screen.findByText("No traceability graph yet")).toBeInTheDocument();
    expect(await screen.findByText(/worklog ia-index/)).toBeInTheDocument();
  });
});
