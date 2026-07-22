import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { buildFixtureRepo } from "./fixture.js";

describe("GET /api/items", () => {
  it("passes through the fake worklog's fold output verbatim", async () => {
    const dir = buildFixtureRepo();
    const app = createApp(dir);
    const res = await app.request("/api/items");
    expect(res.status).toBe(200);
    const items = await res.json();
    expect(items).toEqual([
      { id: "01ARZ3NDEKTSV4RRFFQ69G5FA1", title: "First item", status: "done", priority: "P2", level: "task", kind: "feature" },
      { id: "01KXS7W15SHYS5PSGGWHYMFKYM", title: "No explicit ts", status: "todo", priority: "P3", level: "task", kind: "triage" },
    ]);
  });
});

describe("GET /api/trace-check", () => {
  it("reports a non-zero exit as data, not an HTTP error", async () => {
    const dir = buildFixtureRepo();
    const app = createApp(dir);
    const res = await app.request("/api/trace-check");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.output).toMatch(/no external ticket/);
  });
});
