import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Overview from "./Overview";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const items = [
  { id: "1", title: "Epic in flight", status: "todo", level: "epic", kind: "feature", milestone: "v0.1.0" },
  { id: "2", title: "Todo task", status: "todo", level: "task", kind: "feature", milestone: "v0.1.0" },
  { id: "3", title: "In progress task", status: "in_progress", level: "task", kind: "bug" },
  { id: "4", title: "Blocked task", status: "blocked", level: "task", kind: "ops" },
  { id: "5", title: "Done task", status: "done", level: "task", kind: "feature", milestone: "v0.1.0" },
  { id: "6", title: "Cancelled epic", status: "cancelled", level: "epic", kind: "feature" },
];

const events = [{ ev: "e1", item: "5", op: "close", ts: new Date().toISOString() }];

const docs = {
  version: 1,
  docs: [
    { wiki_key: "status/a", doc_type: "status", title: "old", source: "x", truth_state: "current", date: "2020-01-01" },
    { wiki_key: "status/b", doc_type: "status", title: "new", source: "y", truth_state: "current", date: "2020-01-15" },
  ],
};

beforeEach(() => {
  // jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one.
  // Stubbed here only (Overview's own test file) rather than in the shared
  // test setup — a candidate to move to src/test/setup.ts if another panel
  // ends up rendering a recharts ResponsiveContainer too.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/items") return jsonResponse(items);
      if (url === "/api/events") return jsonResponse(events);
      if (url === "/api/docs") return jsonResponse(docs);
      if (url === "/api/repo") return jsonResponse({ latest_tag: "v0.9.0", drift: {} });
      return jsonResponse({});
    }),
  );
});

describe("Overview", () => {
  it("computes open/in-progress/blocked/epics-in-flight counts from items", async () => {
    render(<Overview />);

    expect(await screen.findByText("Open")).toBeInTheDocument();
    // Open = status "todo" = items 1 and 2 = 2
    expect(screen.getByText("2")).toBeInTheDocument();
    // In progress = 1, Blocked = 1, Epics in flight = 1 (item 1: epic + todo)
    const ones = screen.getAllByText("1");
    expect(ones.length).toBeGreaterThanOrEqual(3);
  });

  it("shows the latest release tag and milestone progress", async () => {
    render(<Overview />);

    expect(await screen.findByText("v0.9.0")).toBeInTheDocument();
    expect(screen.getByText("Milestone progress")).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
    // v0.1.0 has 3 items, 1 done
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("computes days since the newest status doc", async () => {
    render(<Overview />);
    expect(await screen.findByText("Last status report")).toBeInTheDocument();
    // newest status doc date is 2020-01-15, well over a year ago
    expect(screen.getByText(/\d+d ago/)).toBeInTheDocument();
  });
});
