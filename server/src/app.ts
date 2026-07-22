import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { loadTargetRepo, resolveRepoPath, TargetRepoError, type WorklogConfig } from "./repo.js";
import { registerRoutes } from "./routes.js";

export type Env = {
  Variables: {
    repoPath: string;
    config: WorklogConfig;
  };
};

// web/dist relative to this file, whether run via tsx (server/src) or the
// built output (server/dist) — both sit two levels under the repo root.
const here = path.dirname(fileURLToPath(import.meta.url));
const webDistDir = path.resolve(here, "../../web/dist");

export function createApp(repoCandidate?: string) {
  const app = new Hono<Env>();
  const repoPath = resolveRepoPath(repoCandidate);

  // Every /api/* route is scoped to one resolved+validated target repo.
  // Refuse with a clear JSON error instead of crashing when it isn't one.
  app.use("/api/*", async (c, next) => {
    try {
      const target = loadTargetRepo(repoPath);
      c.set("repoPath", target.repoPath);
      c.set("config", target.config);
      await next();
    } catch (err) {
      const status = err instanceof TargetRepoError ? err.status : 500;
      return c.json({ error: err instanceof Error ? err.message : String(err) }, status as 400 | 500);
    }
  });

  registerRoutes(app);

  // Serves the built web app (`npm run build`) so `npm start -- --repo
  // <path>` is a one-command way to get the UI, not just the JSON API.
  // No-op (404s) if web/dist hasn't been built — dev workflows use the Vite
  // dev server + proxy instead, never this.
  if (fs.existsSync(webDistDir)) {
    app.use("*", serveStatic({ root: webDistDir }));
    app.get("*", (c) => {
      if (c.req.path.startsWith("/api/")) return c.notFound();
      return c.html(fs.readFileSync(path.join(webDistDir, "index.html"), "utf8"));
    });
  }

  return app;
}
