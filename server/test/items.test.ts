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
    expect(body.gaps).toBe(1);
  });

  it("reports zero gaps on a clean trace", async () => {
    const dir = buildFixtureRepo();
    // Fixture's fake bin/worklog only knows one trace-check outcome (dirty);
    // simulate the clean case by pointing at a repo whose fake worklog
    // prints only the summary line.
    const fs = await import("node:fs");
    const path = await import("node:path");
    fs.writeFileSync(
      path.join(dir, "bin", "worklog"),
      `#!/usr/bin/env python3\nimport sys\ncmd = sys.argv[1] if len(sys.argv) > 1 else ""\nif cmd == "trace-check":\n    print("trace: no unlinked evidence")\n`,
      { mode: 0o755 },
    );
    const app = createApp(dir);
    const res = await app.request("/api/trace-check");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.gaps).toBe(0);
  });
});
