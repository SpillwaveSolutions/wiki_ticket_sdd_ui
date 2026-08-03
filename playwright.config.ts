import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

// Playwright may load this config as CJS when the root package is not
// "type":"module", so avoid import.meta. process.cwd() is the repo root
// when invoked via `npm run test:e2e`.
const ports = JSON.parse(
  execFileSync(process.execPath, [join(process.cwd(), "scripts/dev-ports.mjs"), "--json"], {
    encoding: "utf8",
  }).trim(),
) as { vite: number; api: number };

const BASE_URL = `http://127.0.0.1:${ports.vite}`;

/**
 * Web-mode e2e for WikiTicket UI.
 * Boots Hono + Vite against a scratch worklog fixture (see e2e-web-server.mjs).
 * Chromium only — CI-stable; desktop paint parity is not the goal here.
 */
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html"], ["list"]] : [["list"]],
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        },
      },
    },
  ],
  webServer: {
    command: "node scripts/e2e-web-server.mjs",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      WT_DEV_PORT: String(ports.vite),
      WT_API_PORT: String(ports.api),
      PORT: String(ports.api),
      VITE_API_PORT: String(ports.api),
    },
  },
});
