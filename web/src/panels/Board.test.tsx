import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Board from "./Board";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const now = Date.now();
const recentClose = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

const items = [
  { id: "epic-1", title: "Ship the thing", status: "in_progress", level: "epic", kind: "feature" },
  { id: "1", title: "Todo item", status: "todo", level: "task", kind: "feature", priority: "P1" },
  {
    id: "2",
    title: "Progress item",
    status: "in_progress",
    level: "task",
    kind: "bug",
    priority: "P0",
    parent: "epic-1",
    unplanned: true,
    external: { system: "github", key: "42", url: "https://github.com/x/y/issues/42" },
  },
  { id: "3", title: "Blocked item", status: "blocked", level: "task", kind: "ops" },
  { id: "4", title: "Recently closed", status: "done", level: "task", kind: "feature" },
  { id: "5", title: "Old closed", status: "done", level: "task", kind: "feature" },
];

const events = [
  { ev: "e1", item: "4", op: "close", ts: recentClose },
  { ev: "e2", item: "5", op: "close", ts: "2020-01-01T00:00:00Z" },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/items") return jsonResponse(items);
      if (url === "/api/events") return jsonResponse(events);
      return jsonResponse({});
    }),
  );
});

describe("Board", () => {
  it("buckets items into todo/in_progress/blocked/recently_done columns", async () => {
    render(<Board />);

    expect(await screen.findByText("Todo item")).toBeInTheDocument();
    expect(screen.getByText("Progress item")).toBeInTheDocument();
    expect(screen.getByText("Blocked item")).toBeInTheDocument();
    // Recently closed (within 14 days) shows; old closed (2020) is excluded
    // because at least one item qualifies within the 14-day window.
    expect(screen.getByText("Recently closed")).toBeInTheDocument();
    expect(screen.queryByText("Old closed")).not.toBeInTheDocument();
  });

  it("renders a card's level/kind/priority badges, epic chip, unplanned flag, and issue link", async () => {
    render(<Board />);
    const card = (await screen.findByText("Progress item")).closest("button");
    expect(card).not.toBeNull();
    const scoped = within(card as HTMLElement);

    expect(scoped.getByText("task")).toBeInTheDocument();
    expect(scoped.getByText("bug")).toBeInTheDocument();
    expect(scoped.getByText("P0")).toBeInTheDocument();
    expect(scoped.getByText("epic: Ship the thing")).toBeInTheDocument();
    expect(scoped.getByText("unplanned")).toBeInTheDocument();
    expect(scoped.getByText("#42")).toBeInTheDocument();
  });

  it("opens the drawer with item JSON and event history on card click", async () => {
    render(<Board />);
    const card = await screen.findByText("Recently closed");
    fireEvent.click(card);

    expect(await screen.findByText("Event history (1)")).toBeInTheDocument();
    expect(screen.getByText("close")).toBeInTheDocument();
  });
});
