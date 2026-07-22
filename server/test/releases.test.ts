import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Simulate `gh` failing/absent AND the network being unreachable — the
// server must never crash and must fall back to an explicit offline shape.
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawnSync: (cmd: string, args: string[], opts: unknown) => {
      if (cmd === "gh") return { status: 1, stdout: "", stderr: "gh: command not found", pid: 0, output: [], signal: null };
      return actual.spawnSync(cmd, args, opts as never);
    },
  };
});

import { createApp } from "../src/app.js";
import { buildFixtureRepo } from "./fixture.js";

describe("GET /api/releases", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network disabled in tests"));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("falls back to {offline: true, releases: []} without crashing when gh and the network both fail", async () => {
    const dir = buildFixtureRepo();
    const app = createApp(dir);
    const res = await app.request("/api/releases");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ offline: true, releases: [] });
    expect(global.fetch).toHaveBeenCalled();
  });
});
