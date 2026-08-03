#!/usr/bin/env node
/**
 * Concurrent web-mode dev: Hono API + Vite, ports pinned via dev-ports.mjs.
 *
 * Usage:
 *   node scripts/dev.mjs
 *   node scripts/dev.mjs -- --repo ../wiki_ticket_sdd
 *
 * Extra args after `--` are forwarded to the server workspace start script
 * (so `--repo` / `--port` work). PORT is always set from the resolver;
 * a trailing `--port` in argv would still be parsed by the server but the
 * env PORT is the source of truth for the Vite proxy.
 */
import { spawn } from "node:child_process";
import { resolveDevPorts } from "./dev-ports.mjs";

const dash = process.argv.indexOf("--");
const serverArgs = dash >= 0 ? process.argv.slice(dash + 1) : [];

const ports = await resolveDevPorts();
const env = {
  ...process.env,
  PORT: String(ports.api),
  WT_API_PORT: String(ports.api),
  VITE_API_PORT: String(ports.api),
  WT_DEV_PORT: String(ports.vite),
};

console.log(`[dev] Vite http://127.0.0.1:${ports.vite}/  API :${ports.api}`);

const children = [];

function start(label, cmd, args) {
  const child = spawn(cmd, args, { stdio: "inherit", env, shell: true });
  children.push(child);
  child.on("exit", (code, signal) => {
    // Tear down the sibling when either side exits.
    for (const c of children) {
      if (c !== child && !c.killed) c.kill("SIGTERM");
    }
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 0);
  });
  child.on("error", (err) => {
    console.error(`[dev] ${label} failed:`, err);
    process.exit(1);
  });
}

// Server first so the proxy has something to talk to when Vite boots.
start("server", "npm", ["run", "-w", "server", "dev", "--", ...serverArgs]);
start("web", "npm", ["run", "-w", "web", "dev"]);

function shutdown() {
  for (const c of children) {
    if (!c.killed) c.kill("SIGTERM");
  }
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
