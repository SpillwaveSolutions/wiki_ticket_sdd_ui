/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// VITE_API_PORT lets smoke tests point the dev proxy at a server running on
// a non-default port without editing this file. Must match the server's own
// default (see server/src/index.ts) when unset.
const apiPort = process.env.VITE_API_PORT || "4181";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
