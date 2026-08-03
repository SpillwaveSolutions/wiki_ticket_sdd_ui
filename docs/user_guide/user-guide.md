---
doc_type: guide
slug: user-guide
title: WikiTicket UI User Guide
truth_state: current
wiki_key: guide/user-guide
---
# WikiTicket UI User Guide

WikiTicket UI is a local, read-only dashboard for any repo that uses
[WikiTicket SDD](https://github.com/SpillwaveSolutions/wiki_ticket_sdd). It
never writes to the repo it's pointed at — every panel just reads
`.work/*.jsonl`, `docs/.index/`, git, and (optionally) GitHub.

As of v0.2.0 there are two ways to run it, sharing the same React UI and the
same 13 read-only endpoints:

1. **Browser mode** — a Node/Hono server serves the API and the built web app
   over HTTP. One process per target repo.
2. **Desktop mode** — a native Tauri 2 app. The same API is ported to Rust
   commands invoked over Tauri IPC instead of HTTP, and you pick the target
   repo with a repo picker (recent history, local-root scanning, GitHub org
   search) instead of a CLI flag.

Panels never know or care which transport they're talking over — see the
[panel tour in the README](../../README.md#panel-tour) for what each one
shows.

## Browser mode (Node server)

```sh
npm install
npm run build
npm start -- --repo /path/to/your/worklog/repo
```

Open the printed URL (`http://localhost:4181` by default).

- `--repo` picks the target repo. If omitted, it falls back to the
  `WORKLOG_REPO` environment variable, then the current directory
  (`server/src/index.ts`).
- `--port <n>` (or `PORT=<n>`) overrides the port.
- The target must contain a `.work/config.yml` — that's how the server
  confirms it's a worklog repo and reads project/ticketing/wiki settings.
  Point it somewhere else and every panel returns a "not a worklog repo"
  error instead of guessing.
- The repo picker in the top bar (see below) only *remembers* paths here —
  the server is bound to one repo for its process lifetime, so switching
  requires restarting `npm start -- --repo <new path>`.

For active development instead of a production build:

```sh
npm run dev   # Hono API + Vite (ports auto-resolved; bases :4181 / :8080)
```

Vite proxies `/api/*` to `http://localhost:4181`; point it at a server on a
different port with `VITE_API_PORT=<port> npm run -w web dev`.

## Desktop mode (Tauri 2)

```sh
npm install
npm run tauri dev     # Vite + Rust shell, hot reload
npm run tauri build   # packaged .app / .dmg (or platform equivalent)
```

`npm run tauri build` output lands under
`src-tauri/target/release/bundle/`. The desktop shell has no `--repo` flag —
instead:

- **First launch with no repo selected**: the app opens the repo picker for
  you automatically (rather than showing every panel as an error).
- **`WORKLOG_REPO`** is an optional seed: set it before launching the
  desktop app and it's used as the initial repo if it's a valid directory,
  so you can skip the picker on repeat runs of the same repo (`src-tauri/src/lib.rs`).
  It's read once at startup, not re-checked while the app is running.
- Switching repos (any picker tab) reloads the whole app so every panel
  remounts against the new target — there's no live in-place repo swap.

The picker has three tabs (desktop only — browser mode keeps the simpler
recent-history view described below):

- **Recent** — every repo you've opened, browser or desktop, remembered in
  local storage. Clicking an entry calls `set_repo` and reloads. Also has
  **Choose folder…**, a native OS folder dialog (`pick_repo` command) for
  any directory containing `.work/config.yml`.
- **Local** — scans root directories you add (folders that hold several repo
  checkouts, e.g. `~/src`, `~/clients/<client>/src`) for worklog-enabled
  repos one level deep. Add/remove roots with the picker in this tab; they
  persist in `~/.config/wicked_ticket/config.json` — app-level state,
  separate from any target repo's own `.work/config.yml`. Only repos with
  `worklog_enabled: true` are listed as clickable candidates.
- **GitHub** — lists your `gh` orgs, then `gh repo list`s the selected org
  and checks each repo for worklog-enablement in the background (6 at a
  time), showing only the ones that qualify as they resolve. **Clone &
  open** does a shallow clone into a managed cache
  (`~/.config/wicked_ticket/clones/`) and switches to it immediately; the
  same tab lists cached clones with per-repo and clear-all cleanup. Needs
  the `gh` CLI installed and authenticated — without it this tab shows an
  install/auth hint instead of an error.

The desktop shell reads the same files the Node server does and carries the
same read-only guarantee: nothing here ever writes to the target repo.

Rust tests (unit + fixture parity against the Node routes) run with:

```sh
cargo test --manifest-path src-tauri/Cargo.toml
```

## Picking a repo, either mode

Open the repo picker from the top bar. It shows the currently active repo
path and, in desktop mode, the Recent/Local/GitHub tabs described above. In
browser mode it's a read-only history plus a field to remember an extra path
for your next `npm start -- --repo`.

## Troubleshooting

- **"not a worklog repo" / "no repo selected"** — the target directory has
  no `.work/config.yml`. Point at the repo root, not a subdirectory.
- **Version-skew badge** — `docs/.index` and `.work/config.yml` say the
  target repo was built against a different `bin/worklog` version than what
  actually runs there. Informational only; the dashboard still works.
- **GitHub-backed panels (Releases, some Activity entries) look empty** —
  the dashboard degrades gracefully without the `gh` CLI or network access;
  everything file-based (Board, Roadmap, Docs, Publish plane, Sync health,
  Charts, Traceability) still works fully offline.

## See also

- [README](../../README.md) — quickstart, full panel tour, architecture.
- [Wireframes](./wireframes.md) — PlantUML Salt wireframe for every screen.
- Governing plan: `docs/plans/2026-07-22-wiki-ticket-ui-ia.md` (pointer only
  — frozen design lives in the main `wiki_ticket_sdd` repo).
- `docs/plans/2026-07-23-tauri-desktop-shell.md` — how the desktop shell was
  built.
