# WikiTicket UI — Desktop (Tauri) + Web testing

Dual-mode app:

| Mode | How | API |
|------|-----|-----|
| **Web** | `npm run dev` · `npm start` | Hono JSON on the resolved API port; Vite proxies `/api/*` |
| **Desktop (Tauri)** | `npm run tauri:dev` · `npm run tauri:build` | Rust `invoke()` (`src-tauri/`) — no Node server |

Web mode is the **Playwright / browser-agent** surface. Desktop mode produces standalone installers under `src-tauri/target/release/bundle/`.

## Prerequisites

### Web only
- Node 22+
- Playwright Chromium (for e2e): `npx playwright install chromium`

### Desktop build
- Rust (rustc 1.77+)
- [Tauri 2 system dependencies](https://v2.tauri.app/start/prerequisites/)
  - **macOS**: Xcode CLT
  - **Linux**: WebKitGTK, GTK 3, …
  - **Windows**: WebView2 + VC++ build tools

## Ports

Several Spillwave Tauri apps may run on one machine. Ports are resolved by
`scripts/dev-ports.mjs` and remembered in gitignored `.dev-ports.json`:

| Role | Preferred base | Env override |
|------|----------------|--------------|
| Vite (UI) | 8080 | `WT_DEV_PORT` |
| Hono API | 4181 | `WT_API_PORT` / `PORT` / `VITE_API_PORT` |

```bash
npm run port              # allocate/print vite=… api=…
npm run port -- --url     # http://127.0.0.1:<vite>/
npm run port -- --peek    # remember without allocating
```

`npm run tauri:dev` patches Tauri's `devUrl` to the resolved Vite port.

## Commands

```bash
# Web
npm run dev              # API + Vite (ports auto-resolved)
npm run build
npm run typecheck
npm test                 # vitest (server + web, including Tauri mockIPC)
npm run test:e2e         # Playwright against fixture repo
npm run verify           # typecheck + unit + e2e
npm run smoke            # headless load + screenshot (server must already be up)

# Desktop
npm run tauri:dev        # Vite + Tauri webview
npm run tauri:build      # release binary + installers
npm run test:rust        # fixture parity (needs system libs on Linux)

# Aliases
npm run desktop:dev
npm run desktop:build
```

## Local desktop build

```bash
npm install
npm run tauri:build
```

Artifacts (host OS dependent):

```
src-tauri/target/release/wiki-ticket-ui   # raw binary name may vary
src-tauri/target/release/bundle/
  dmg/  msi/  appimage/  deb/  …
```

Windows portable runs need **WebView2** (`webviewInstallMode: downloadBootstrapper` in `tauri.conf.json`).

## Architecture

```
web/src/lib/api.ts        ← fetch (web) | invoke (Tauri)
server/src/routes.ts      ← Hono handlers
src-tauri/src/commands.rs ← Rust port of the same surface
server/test/fixture.ts    ← throwaway worklog repo for tests
e2e/                      ← Playwright (web mode)
scripts/dev-ports.mjs     ← dual port resolver
scripts/e2e-web-server.mjs← Playwright webServer orchestrator
```

**Read-only guarantee:** neither the Node server nor the Tauri shell writes to the target worklog repo.

## Wireframes

PlantUML Salt sources for every panel live in [`docs/ui/wireframes/`](./docs/ui/wireframes/).

```bash
npm run wireframes         # regenerate PNGs (requires plantuml)
npm run wireframes:check   # syntax only
```

See [`docs/ui/README.md`](./docs/ui/README.md) for the screen inventory and
acceptable differences when reviewing screenshots against Salt renders.

## Smoke checklist (before claiming a UI change is ready)

1. `npm run verify` green
2. Optional: `npm run dev -- --repo ../wiki_ticket_sdd` then `npm run smoke`
3. Tauri-only paths: unit tests via `@tauri-apps/api/mocks`, or mock `__TAURI_INTERNALS__` in agent-browser
4. Rick's final human pass
