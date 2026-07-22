import { Hono } from "hono";
import { loadTargetRepo, resolveRepoPath, TargetRepoError, type WorklogConfig } from "./repo.js";
import { registerRoutes } from "./routes.js";

export type Env = {
  Variables: {
    repoPath: string;
    config: WorklogConfig;
  };
};

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
  return app;
}
