#!/usr/bin/env node
/**
 * `tauri dev` with a dynamic devUrl.
 *
 * tauri.conf.json's build.devUrl is static fallback JSON. The Vite port is
 * resolved at runtime (scripts/dev-ports.mjs) because several Tauri projects
 * share this machine. The Tauri CLI's --config flag merges a JSON patch.
 *
 * WT_DEV_PORT is exported so the Vite server started by beforeDevCommand
 * binds exactly the port the webview is pointed at.
 */
import { spawn } from "node:child_process";
import { resolveDevPorts } from "./dev-ports.mjs";

const ports = await resolveDevPorts();
const devUrl = `http://127.0.0.1:${ports.vite}`;
const patch = JSON.stringify({ build: { devUrl } });

console.log(`[tauri-dev] devUrl ${devUrl}`);

const child = spawn(
  "npx",
  ["tauri", "dev", "--config", patch, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      WT_DEV_PORT: String(ports.vite),
      // Vite proxy still needs an API port if something hits /api in hybrid
      // experiments; desktop mode uses invoke() so this is unused in normal path.
      VITE_API_PORT: String(ports.api),
      WT_API_PORT: String(ports.api),
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
