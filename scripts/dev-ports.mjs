/**
 * Dual-port resolver for WikiTicket UI (Vite + Hono API).
 *
 * Several Spillwave Tauri apps run side by side on one machine. Hardcoded
 * ports collide: Vite with strictPort refuses to boot, and Playwright's
 * reuseExistingServer can silently attach to another project's app.
 *
 * Resolution order (per role):
 *   1. Env override (always wins)
 *   2. Remembered port in .dev-ports.json if free or already serving us
 *   3. First free port at or above the role's base
 *
 * CLI:
 *   node scripts/dev-ports.mjs              -> "vite=<n> api=<n>"
 *   node scripts/dev-ports.mjs --json       -> {"vite":n,"api":n}
 *   node scripts/dev-ports.mjs --url        -> http://127.0.0.1:<vite>/
 *   node scripts/dev-ports.mjs --vite       -> vite port only
 *   node scripts/dev-ports.mjs --api        -> api port only
 *   node scripts/dev-ports.mjs --peek       -> remembered/base without allocating
 */
import { createServer } from "node:net";
import { execFileSync } from "node:child_process";
import { get } from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT_FILE = join(ROOT, ".dev-ports.json");

/** Marker in HTML title proving a responding server is this app. */
const APP_MARKER = "WikiTicket UI";

export const BASE_VITE_PORT = 8080;
export const BASE_API_PORT = 4181;
const RANGE = 100;

function isFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, "0.0.0.0", () => srv.close(() => resolve(true)));
  });
}

function servesThisApp(port) {
  return new Promise((resolve) => {
    let done = false;
    const settle = (v) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      req.destroy();
      resolve(v);
    };
    const timer = setTimeout(() => settle(false), 1500);

    const req = get({ host: "127.0.0.1", port, path: "/" }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        body += c;
        if (body.length > 65536) settle(body.includes(APP_MARKER));
      });
      res.on("end", () => settle(body.includes(APP_MARKER)));
      res.on("error", () => settle(false));
    });
    req.on("error", () => settle(false));
  });
}

function readFile() {
  if (!existsSync(PORT_FILE)) return {};
  try {
    const raw = JSON.parse(readFileSync(PORT_FILE, "utf8"));
    return typeof raw === "object" && raw !== null ? raw : {};
  } catch {
    return {};
  }
}

function writeFile(ports) {
  writeFileSync(PORT_FILE, `${JSON.stringify(ports, null, 2)}\n`);
  return ports;
}

function envInt(...names) {
  for (const name of names) {
    const n = Number.parseInt(process.env[name] ?? "", 10);
    if (Number.isInteger(n) && n > 0 && n < 65536) return n;
  }
  return null;
}

async function resolveOne(role, base, envNames, remembered) {
  const fromEnv = envInt(...envNames);
  if (fromEnv !== null) return fromEnv;

  if (remembered !== null && remembered !== undefined) {
    if (await isFree(remembered)) return remembered;
    if (await servesThisApp(remembered)) return remembered;
  }

  for (let p = base; p < base + RANGE; p++) {
    if (p === remembered) continue;
    if (await isFree(p)) {
      if (remembered != null) {
        console.error(
          `[dev-ports] ${role} port ${remembered} is taken; using ${p} instead.`,
        );
      }
      return p;
    }
  }
  throw new Error(`No free ${role} port in ${base}-${base + RANGE - 1}`);
}

/**
 * Resolve both ports. Writes .dev-ports.json when allocating.
 * @returns {Promise<{vite: number, api: number}>}
 */
export async function resolveDevPorts() {
  const prev = readFile();
  const vite = await resolveOne(
    "vite",
    BASE_VITE_PORT,
    ["WT_DEV_PORT", "DEV_PORT"],
    prev.vite,
  );
  const api = await resolveOne(
    "api",
    BASE_API_PORT,
    ["WT_API_PORT", "PORT", "VITE_API_PORT"],
    prev.api,
  );
  // Avoid same number for both roles if the ranges somehow collide.
  let apiFinal = api;
  if (apiFinal === vite) {
    apiFinal = await resolveOne("api", vite + 1, [], null);
  }
  return writeFile({ vite, api: apiFinal });
}

/** Sync resolve via subprocess — for Playwright / configs that cannot await. */
export function resolveDevPortsSync() {
  const out = execFileSync(process.execPath, [fileURLToPath(import.meta.url), "--json"], {
    encoding: "utf8",
  });
  return JSON.parse(out.trim());
}

/**
 * Remembered / env / base without probing free ports.
 * @returns {{vite: number, api: number}}
 */
export function peekDevPorts() {
  const prev = readFile();
  return {
    vite: envInt("WT_DEV_PORT", "DEV_PORT") ?? prev.vite ?? BASE_VITE_PORT,
    api: envInt("WT_API_PORT", "PORT", "VITE_API_PORT") ?? prev.api ?? BASE_API_PORT,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  (async () => {
    const ports = args.includes("--peek") ? peekDevPorts() : await resolveDevPorts();
    if (args.includes("--json")) {
      process.stdout.write(`${JSON.stringify(ports)}\n`);
    } else if (args.includes("--url")) {
      process.stdout.write(`http://127.0.0.1:${ports.vite}/\n`);
    } else if (args.includes("--vite")) {
      process.stdout.write(`${ports.vite}\n`);
    } else if (args.includes("--api")) {
      process.stdout.write(`${ports.api}\n`);
    } else {
      process.stdout.write(`vite=${ports.vite} api=${ports.api}\n`);
    }
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
