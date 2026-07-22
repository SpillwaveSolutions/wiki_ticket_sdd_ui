import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadTargetRepo, parseFlatYaml, TargetRepoError } from "../src/repo.js";
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
