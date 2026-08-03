#!/usr/bin/env node
/**
 * Dual-process web server for Playwright e2e.
 *
 * 1. Builds a throwaway worklog fixture (server/test/build-fixture.ts)
 * 2. Starts Hono on the resolved API port with WORKLOG_REPO=fixture
 * 3. Starts Vite on the resolved Vite port proxying /api → API
 *
 * Env (set by playwright.config.ts):
 *   WT_DEV_PORT, WT_API_PORT / PORT / VITE_API_PORT — already pinned
 *   WORKLOG_REPO — optional; fixture used if unset
 *
 * Stays alive until SIGTERM/SIGINT; kills both children on exit.
 */
import { spawn, execFileSync } from "node:child_process";
import { resolveDevPorts } from "./dev-ports.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function fixturePath() {
  if (process.env.WORKLOG_REPO) return process.env.WORKLOG_REPO;
  const out = execFileSync("npx", ["tsx", "server/test/build-fixture.ts"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return out.trim();
}

const ports = await resolveDevPorts();
const repo = fixturePath();

const env = {
  ...process.env,
  PORT: String(ports.api),
  WT_API_PORT: String(ports.api),
  VITE_API_PORT: String(ports.api),
  WT_DEV_PORT: String(ports.vite),
  WORKLOG_REPO: repo,
};

console.log(`[e2e-web-server] repo=${repo}`);
console.log(`[e2e-web-server] Vite :${ports.vite}  API :${ports.api}`);

const children = [];

function start(label, cmd, args) {
  const child = spawn(cmd, args, {
    cwd: ROOT,
    env,
    stdio: ["ignore", "inherit", "inherit"],
    shell: true,
  });
  children.push(child);
  child.on("exit", (code, signal) => {
    if (signal === "SIGTERM" || signal === "SIGINT") return;
    console.error(`[e2e-web-server] ${label} exited code=${code} signal=${signal}`);
    shutdown();
    process.exit(code ?? 1);
  });
}

function shutdown() {
  for (const c of children) {
    if (!c.killed) c.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

// Use `start` (compiled JS) when dist exists is fragile in CI; tsx watch is for
// dev. For e2e, run the server entry via tsx once (no watch) so restarts don't
// race Playwright.
start("server", "npx", [
  "tsx",
  "server/src/index.ts",
  "--repo",
  repo,
  "--port",
  String(ports.api),
]);
start("web", "npm", ["run", "-w", "web", "dev"]);
