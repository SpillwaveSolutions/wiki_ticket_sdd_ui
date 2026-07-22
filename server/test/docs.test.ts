import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { buildFixtureRepo } from "./fixture.js";

describe("GET /api/docs and /api/index/*", () => {
  it("returns _inventory.json verbatim", async () => {
    const dir = buildFixtureRepo();
    const app = createApp(dir);
    const res = await app.request("/api/docs");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.docs[0].wiki_key).toBe("adr/0001-test");
  });

  it("returns _graph.json and publish-manifest.json verbatim", async () => {
    const dir = buildFixtureRepo();
    const app = createApp(dir);
    const graphRes = await app.request("/api/index/graph");
    expect((await graphRes.json()).edges).toHaveLength(1);
    const manifestRes = await app.request("/api/index/manifest");
    expect((await manifestRes.json()).pages).toHaveLength(3);
  });
});

describe("GET /api/docs/content", () => {
  it("serves a doc's raw markdown from inside docs/", async () => {
    const dir = buildFixtureRepo();
    const app = createApp(dir);
    const res = await app.request("/api/docs/content?path=docs/adr/0001-test.md");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Frozen content.");
  });

  it("rejects path traversal outside docs/", async () => {
    const dir = buildFixtureRepo();
    const app = createApp(dir);
    const res = await app.request(
      "/api/docs/content?" + new URLSearchParams({ path: "../.work/config.yml" }).toString(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/escapes docs/);
  });

  it("rejects an absolute path pointed at a file outside the repo", async () => {
    const dir = buildFixtureRepo();
    const app = createApp(dir);
    const res = await app.request(
      "/api/docs/content?" + new URLSearchParams({ path: "/etc/passwd" }).toString(),
    );
    expect(res.status).toBe(400);
  });
});
