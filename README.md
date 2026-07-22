# WikiTicket UI

A local, read-only dashboard for any repository that uses
[WikiTicket SDD](https://github.com/SpillwaveSolutions/wiki_ticket_sdd)
("wicked ticket") — spec-driven development with visible WIP, tracked in a
git-native event log.

Point it at a worklog-enabled repo and see the whole project at once: kanban
board, live roadmap with Mermaid diagrams, activity feed, releases, docs
browser with truth-state badges, the wiki publish plane with drift detection,
sync health, charts, and an interactive traceability graph
(plan → item → ticket → PR → release).

![Overview panel](docs/images/overview.jpg)

## Quickstart

```sh
npm install
npm run build
npm start -- --repo /path/to/your/worklog/repo
```

Open the printed URL (`http://localhost:4181` by default). That's it — one
process serves both the JSON API and the built web app.

`--repo` defaults to `$WORKLOG_REPO`, then the current directory, if omitted.
Override the port with `--port <n>` or `PORT=<n>`.

## Panel tour

| Panel | What it shows |
|---|---|
| **Overview** | Open/in-progress/blocked counts, epics in flight, latest release, milestone progress bars, 30-day activity sparkline. |
| **Board** | Kanban columns (todo / in progress / blocked / recently done) with a per-item detail drawer and full event history. |
| **Roadmap** | `docs/roadmap.md` rendered live — headings, GFM tables, and Mermaid diagrams — with a table of contents. |
| **Activity** | Merged, filterable feed of worklog events, git commits, and GitHub releases, newest first. |
| **Releases** | GitHub release timeline linked to their frozen roadmap snapshots. |
| **Docs** | Inventory-driven browser (`docs/.index/_inventory.json`) with truth-state badges, search/filter, and navigable supersede chains. |
| **Publish plane** | Three-way wiki drift: in-sync, pending-republish, or source-drift (a frozen page edited after publish). |
| **Sync health** | `.work/sync-state.json` cursors, unpushed open items, and orphan/conflict alerts. |
| **Charts** | Burnup, kind mix, weekly velocity, and unplanned-work ratio, computed from the raw event log. |
| **Traceability** | Interactive `_graph.json` explorer — walk any node's evidence chain both directions — plus a trace-check integrity checklist. |

![Traceability panel](docs/images/traceability.jpg)

![Board panel](docs/images/board.jpg)

Design record: [`docs/plans/2026-07-22-wiki-ticket-ui-ia.md`](docs/plans/2026-07-22-wiki-ticket-ui-ia.md)
(pointer only — the frozen plan lives in the main repo; see `CLAUDE.md`).

## Architecture

One Hono JSON API server (`server/`) plus one Vite/React/Tailwind front end
(`web/`), built as an npm workspace. The server binds to exactly one target
repo per process (`--repo`) and only ever *reads* it:

- Shells out to the target's own `bin/worklog` (`fold`, `trace-check`) —
  never reimplements worklog or IA semantics.
- Reads the target's committed `docs/.index/` plane (`_inventory.json`,
  `_graph.json`, `publish-manifest.json`) directly — it's deterministic and
  byte-verbatim, no need to shell out for it.
- Reads `.work/*.jsonl`, `.work/published.json`, `.work/sync-state.json`,
  and git/`gh` for everything else, falling back to an offline state
  wherever GitHub access isn't available.

**Read-only guarantee**: this app never writes to the target repo. In
production (`npm start`), the server also serves the built `web/dist` static
assets, so one process is the whole app; in development, Vite serves the
front end and proxies `/api/*` to the server.

## Development

```sh
npm install
npm run dev          # tsx-watch server (:4181) + Vite dev server (:5173), concurrently
npm run typecheck     # both workspaces
npm test              # vitest, both workspaces
```

The Vite dev server proxies `/api/*` to `http://localhost:4181`; point it at
a server on a different port with `VITE_API_PORT=<port> npm run -w web dev`.

Dogfood target for manual verification: `../wiki_ticket_sdd` (the repo this
tool was built to observe), i.e. `npm start -- --repo ../wiki_ticket_sdd`.
