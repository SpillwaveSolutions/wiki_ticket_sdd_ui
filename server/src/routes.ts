import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Hono } from "hono";
import type { Env } from "./app.js";
import { parseFlatYaml, resolveDocPath, TargetRepoError } from "./repo.js";
import { ulidTimestampIso } from "./ulid.js";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function sha256_12(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 12);
}

/** Reads a JSON file and returns it byte-verbatim (no reparse/reformat). */
function readJsonVerbatim(c: any, fullPath: string) {
  if (!fs.existsSync(fullPath)) {
    return c.json({ error: `not found: ${path.basename(fullPath)}` }, 404);
  }
  const raw = fs.readFileSync(fullPath, "utf8");
  return c.body(raw, 200, JSON_HEADERS);
}

function readJsonlEvents(fullPath: string): any[] {
  if (!fs.existsSync(fullPath)) return [];
  return fs
    .readFileSync(fullPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/** Runs a read-only command in the target repo. Never mutates it. */
function run(cmd: string, args: string[], cwd: string) {
  return spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}

export function registerRoutes(app: Hono<Env>) {
  app.get("/api/repo", (c) => {
    const repoPath = c.get("repoPath");
    const config = c.get("config");

    const branchRes = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], repoPath);
    const branch = branchRes.status === 0 ? branchRes.stdout.trim() : null;

    const tagRes = run("git", ["describe", "--tags", "--abbrev=0"], repoPath);
    const latestTag = tagRes.status === 0 ? tagRes.stdout.trim() : null;

    const statusRes = run("git", ["status", "--porcelain"], repoPath);
    const dirty = statusRes.status === 0 ? statusRes.stdout.trim().length > 0 : false;

    const versionRes = run("python3", ["bin/worklog", "--version"], repoPath);
    const worklogVersion = versionRes.status === 0 ? versionRes.stdout.trim() : null;
    const installedVersion = typeof config.installed === "string" ? config.installed : null;
    const versionSkew = Boolean(
      installedVersion && worklogVersion && installedVersion !== worklogVersion,
    );

    return c.json({
      name: config.project?.name ?? null,
      key: config.project?.key ?? null,
      repo_path: repoPath,
      github_project: config.ticketing?.project ?? null,
      wiki_root_url: config.wiki?.root_url ?? null,
      branch,
      latest_tag: latestTag,
      installed_version: installedVersion,
      worklog_version: worklogVersion,
      drift: { dirty, version_skew: versionSkew },
    });
  });

  app.get("/api/items", (c) => {
    const repoPath = c.get("repoPath");
    const res = run("python3", ["bin/worklog", "fold"], repoPath);
    if (res.status !== 0) {
      return c.json({ error: "worklog fold failed", detail: res.stderr }, 500);
    }
    try {
      return c.json(JSON.parse(res.stdout));
    } catch {
      return c.json({ error: "worklog fold produced invalid JSON" }, 500);
    }
  });

  app.get("/api/events", (c) => {
    const repoPath = c.get("repoPath");
    const events = [
      ...readJsonlEvents(path.join(repoPath, ".work", "todo.jsonl")),
      ...readJsonlEvents(path.join(repoPath, ".work", "done.jsonl")),
    ].map((ev) => ({ ...ev, ts: ev.ts || ulidTimestampIso(ev.ev) }));
    events.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
    return c.json(events);
  });

  app.get("/api/roadmap", (c) => {
    const repoPath = c.get("repoPath");
    const config = c.get("config");
    const roadmapRel = config.paths?.roadmap || "docs/roadmap.md";
    const fullPath = path.join(repoPath, roadmapRel);
    if (!fs.existsSync(fullPath)) {
      return c.json({ error: `roadmap not found: ${roadmapRel}` }, 404);
    }
    const markdown = fs.readFileSync(fullPath, "utf8");
    let meta: Record<string, any> = {};
    if (markdown.startsWith("---")) {
      const end = markdown.indexOf("\n---", 3);
      if (end !== -1) {
        const frontmatter = markdown.slice(markdown.indexOf("\n") + 1, end);
        meta = parseFlatYaml(frontmatter);
      }
    }
    return c.json({ meta, markdown });
  });

  app.get("/api/docs", (c) => {
    const repoPath = c.get("repoPath");
    return readJsonVerbatim(c, path.join(repoPath, "docs", ".index", "_inventory.json"));
  });

  app.get("/api/docs/content", (c) => {
    const repoPath = c.get("repoPath");
    const requested = c.req.query("path");
    if (!requested) return c.json({ error: "missing ?path=" }, 400);
    let fullPath: string;
    try {
      fullPath = resolveDocPath(repoPath, requested);
    } catch (err) {
      const status = err instanceof TargetRepoError ? err.status : 400;
      return c.json({ error: err instanceof Error ? err.message : String(err) }, status as 400);
    }
    if (!fs.existsSync(fullPath)) return c.json({ error: `not found: ${requested}` }, 404);
    return c.body(fs.readFileSync(fullPath, "utf8"), 200, {
      "Content-Type": "text/markdown; charset=utf-8",
    });
  });

  app.get("/api/index/graph", (c) => {
    const repoPath = c.get("repoPath");
    return readJsonVerbatim(c, path.join(repoPath, "docs", ".index", "_graph.json"));
  });

  app.get("/api/index/manifest", (c) => {
    const repoPath = c.get("repoPath");
    return readJsonVerbatim(c, path.join(repoPath, "docs", ".index", "publish-manifest.json"));
  });

  app.get("/api/wiki-ledger", (c) => {
    const repoPath = c.get("repoPath");
    const ledgerPath = path.join(repoPath, ".work", "published.json");
    const manifestPath = path.join(repoPath, "docs", ".index", "publish-manifest.json");
    if (!fs.existsSync(ledgerPath)) {
      return c.json({ error: "published.json not found" }, 404);
    }
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
      : { pages: [] };
    const manifestByKey = new Map<string, any>(
      (manifest.pages || []).map((p: any) => [p.wiki_key, p]),
    );

    const withDrift: Record<string, any> = {};
    for (const [key, entry] of Object.entries<any>(ledger)) {
      const page = manifestByKey.get(entry.wiki_key || key);
      let drift = "unknown";
      if (page) {
        let sourceDrift = false;
        if (page.frozen && entry.source_hash && entry.source) {
          const sourcePath = path.join(repoPath, entry.source);
          if (fs.existsSync(sourcePath)) {
            const actualHash = sha256_12(fs.readFileSync(sourcePath));
            sourceDrift = actualHash !== entry.source_hash;
          }
        }
        drift = sourceDrift ? "source-drift" : page.render_hash !== entry.render_hash ? "pending" : "in-sync";
      }
      withDrift[key] = { ...entry, drift };
    }
    return c.json(withDrift);
  });

  app.get("/api/sync", (c) => {
    const repoPath = c.get("repoPath");
    return readJsonVerbatim(c, path.join(repoPath, ".work", "sync-state.json"));
  });

  app.get("/api/git/log", (c) => {
    const repoPath = c.get("repoPath");
    const limitParam = Number(c.req.query("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 20;
    const res = run(
      "git",
      ["log", `-n`, String(limit), "--pretty=format:%H%x1f%an%x1f%aI%x1f%s"],
      repoPath,
    );
    if (res.status !== 0) return c.json({ error: "git log failed", detail: res.stderr }, 500);
    const commits = res.stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, author, date, subject] = line.split("\x1f");
        return { hash, author, date, subject };
      });
    return c.json(commits);
  });

  app.get("/api/releases", async (c) => {
    const repoPath = c.get("repoPath");
    const config = c.get("config");
    const project = config.ticketing?.project;
    if (!project) return c.json({ offline: true, releases: [] });

    const ghRes = run("gh", ["api", `repos/${project}/releases`], repoPath);
    if (ghRes.status === 0) {
      try {
        return c.json({ offline: false, releases: JSON.parse(ghRes.stdout) });
      } catch {
        // fall through to REST fallback
      }
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${project}/releases`);
      if (res.ok) {
        return c.json({ offline: false, releases: await res.json() });
      }
    } catch {
      // network unavailable — fall through to offline response
    }
    return c.json({ offline: true, releases: [] });
  });

  app.get("/api/trace-check", (c) => {
    const repoPath = c.get("repoPath");
    const res = run("python3", ["bin/worklog", "trace-check"], repoPath);
    return c.json({ ok: res.status === 0, output: (res.stdout || "") + (res.stderr || "") });
  });
}
