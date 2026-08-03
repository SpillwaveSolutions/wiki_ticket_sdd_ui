/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const portFile = join(root, ".dev-ports.json");

/**
 * Ports pinned by scripts/dev-ports.mjs (or env). Falls back to bases so
 * unit tests and ad-hoc `npm run -w web dev` still work without a prior
 * resolve step.
 */
function readPorts(): { vite: number; api: number } {
  const envVite = Number.parseInt(process.env.WT_DEV_PORT || process.env.DEV_PORT || "", 10);
  const envApi = Number.parseInt(
    process.env.VITE_API_PORT || process.env.WT_API_PORT || process.env.PORT || "",
    10,
  );
  let file: { vite?: number; api?: number } = {};
  if (existsSync(portFile)) {
    try {
      file = JSON.parse(readFileSync(portFile, "utf8"));
    } catch {
      // ignore corrupt file
    }
  }
  return {
    vite: Number.isInteger(envVite) && envVite > 0 ? envVite : (file.vite ?? 8080),
    api: Number.isInteger(envApi) && envApi > 0 ? envApi : (file.api ?? 4181),
  };
}

const ports = readPorts();

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: ports.vite,
    // Resolver already picked a free port; bind failure should be loud.
    strictPort: true,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${ports.api}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: ports.vite,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
