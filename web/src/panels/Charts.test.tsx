import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Charts, { computeBurnup, computeKindMix, computeUnplannedRatio, computeVelocity } from "./Charts";
import type { WorklogEvent, WorklogItem } from "../lib/types";

// jsdom has no ResizeObserver; recharts' ResponsiveContainer needs one.
// ponytail: local stub, only this file renders recharts components.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const EVENTS: WorklogEvent[] = [
  { ev: "1", item: "a", op: "create", ts: "2026-07-17T10:00:00Z" },
  { ev: "2", item: "b", op: "create", ts: "2026-07-17T11:00:00Z" },
  { ev: "3", item: "a", op: "close", ts: "2026-07-18T09:00:00Z" },
  { ev: "4", item: "c", op: "create", ts: "2026-07-19T09:00:00Z" },
  { ev: "5", item: "c", op: "close", ts: "2026-07-19T12:00:00Z" },
];

describe("Charts data shaping", () => {
  it("computes a cumulative burnup series from fixture events", () => {
    const series = computeBurnup(EVENTS);
    expect(series).toEqual([
      { date: "2026-07-17", created: 2, closed: 0 },
      { date: "2026-07-18", created: 2, closed: 1 },
      { date: "2026-07-19", created: 3, closed: 2 },
    ]);
  });

  it("computes kind mix defaulting missing kind to triage", () => {
    const items: WorklogItem[] = [
      { id: "1", title: "x", status: "todo", kind: "feature" },
      { id: "2", title: "y", status: "todo", kind: "bug" },
      { id: "3", title: "z", status: "todo" }, // no kind -> triage default
    ];
    const mix = computeKindMix(items);
    expect(mix).toEqual([
      { kind: "feature", count: 1 },
      { kind: "bug", count: 1 },
      { kind: "ops", count: 0 },
      { kind: "triage", count: 1 },
    ]);
  });

  it("computes velocity as closes-per-ISO-week, zero-filled, ending at `now`", () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const velocity = computeVelocity(EVENTS, now);
    expect(velocity).toHaveLength(12);
    const thisWeek = velocity[velocity.length - 1];
    expect(thisWeek.week).toBe("2026-W29"); // 2026-07-19 is in ISO week 29
    expect(thisWeek.closes).toBe(2); // the two close events both fall in this week
  });

  it("computes unplanned ratio per week of item creation", () => {
    const now = new Date("2026-07-19T12:00:00Z");
    const items: WorklogItem[] = [
      { id: "a", title: "a", status: "done", unplanned: true },
      { id: "b", title: "b", status: "todo", unplanned: false },
      { id: "c", title: "c", status: "done", unplanned: true },
    ];
    const ratio = computeUnplannedRatio(EVENTS, items, now);
    const thisWeek = ratio[ratio.length - 1];
    // a and b created in week 29, c also created in week 29 -> 3 total, 2 unplanned
    expect(thisWeek.total).toBe(3);
    expect(thisWeek.ratio).toBeCloseTo(2 / 3);
  });
});

describe("Charts panel", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/events") {
          return new Response(JSON.stringify(EVENTS), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url === "/api/items") {
          return new Response(
            JSON.stringify([{ id: "a", title: "a", status: "done", kind: "feature" }]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );
  });

  it("renders the 2x2 chart grid shallowly once data loads", async () => {
    render(<Charts />);

    expect(await screen.findByText(/Burnup/i)).toBeInTheDocument();
    expect(screen.getByText(/Kind mix/i)).toBeInTheDocument();
    expect(screen.getByText(/Velocity/i)).toBeInTheDocument();
    expect(screen.getByText(/Unplanned ratio/i)).toBeInTheDocument();
  });
});
