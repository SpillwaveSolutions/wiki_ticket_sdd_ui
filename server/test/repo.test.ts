import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadTargetRepo, parseFlatYaml, resolveRepoPath, TargetRepoError } from "../src/repo.js";
import { buildFixtureRepo } from "./fixture.js";

describe("target repo resolution", () => {
  it("loads config.yml from a valid worklog repo", () => {
    const dir = buildFixtureRepo();
    const { config } = loadTargetRepo(dir);
    expect(config.project?.key).toBe("FIX");
    expect(config.project?.name).toBe("Fixture Project");
    expect(config.ticketing?.project).toBe("acme/fixture-repo");
    expect(config.wiki?.root_url).toBe("https://github.com/acme/fixture-repo/wiki");
    expect(config.paths?.roadmap).toBe("docs/roadmap.md");
    expect(config.installed).toBe("0.1.0");
  });

  it("rejects a directory with no .work/config.yml", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-not-a-repo-"));
    expect(() => loadTargetRepo(dir)).toThrow(TargetRepoError);
  });

  it("strips inline comments without corrupting quoted values", () => {
    const config = parseFlatYaml('project:\n  name: "Has # not a comment"\n');
    expect(config.project.name).toBe("Has # not a comment");
  });
});

describe("resolveRepoPath", () => {
  const ORIGINAL_INIT_CWD = process.env.INIT_CWD;

  afterEach(() => {
    if (ORIGINAL_INIT_CWD === undefined) delete process.env.INIT_CWD;
    else process.env.INIT_CWD = ORIGINAL_INIT_CWD;
  });

  it("resolves a relative --repo against INIT_CWD, not the workspace's own cwd", () => {
    // Regression: `npm start` -> `npm run -w server start --` runs with
    // process.cwd() == server/, not the directory `npm start` was invoked
    // from. A bare `path.resolve(candidate)` silently resolved "../foo"
    // against server/ instead — this is exactly the bug a live browser
    // pass against the built app surfaced.
    process.env.INIT_CWD = "/Users/example/clients/wiki_ticket_sdd_ui";
    expect(resolveRepoPath("../wiki_ticket_sdd")).toBe("/Users/example/clients/wiki_ticket_sdd");
  });

  it("passes an absolute --repo through unaffected by INIT_CWD", () => {
    process.env.INIT_CWD = "/Users/example/clients/wiki_ticket_sdd_ui/server";
    expect(resolveRepoPath("/Users/example/other/repo")).toBe("/Users/example/other/repo");
  });

  it("falls back to process.cwd() when INIT_CWD is unset (direct `node dist/index.js`)", () => {
    delete process.env.INIT_CWD;
    expect(resolveRepoPath("../wiki_ticket_sdd")).toBe(path.resolve(process.cwd(), "../wiki_ticket_sdd"));
  });
});

describe("/api/repo version skew", () => {
  it("no skew when CLI 'worklog X.Y.Z' matches config installed X.Y.Z", async () => {
    const dir = buildFixtureRepo();
    const app = createApp(dir);
    const res = await app.request("/api/repo");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.worklog_version).toBe("0.1.0");
    expect(body.drift.version_skew).toBe(false);
  });
});

describe("app-level rejection of non-worklog repos", () => {
  it("returns a 400 JSON error instead of crashing", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-not-a-repo-"));
    const app = createApp(dir);
    const res = await app.request("/api/repo");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/\.work\/config\.yml/);
  });
});
