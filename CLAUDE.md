# WikiTicket UI — agent instructions

This repo is the **deliverable** of a plan that lives elsewhere. Read this
before doing anything.

## Where the truth lives

- **Governing plan (frozen):** `docs/plans/2026-07-22-wiki-ticket-ui-ia.md` in
  the main repo — locally at `../wiki_ticket_sdd`, on GitHub at
  [SpillwaveSolutions/wiki_ticket_sdd](https://github.com/SpillwaveSolutions/wiki_ticket_sdd),
  published as
  [Plan-wiki-ticket-ui-ia](https://github.com/SpillwaveSolutions/wiki_ticket_sdd/wiki/Plan-wiki-ticket-ui-ia).
  Read it before implementing anything here.
- **Work tracking:** tracked HERE, in this repo's own worklog
  (`.work/todo.jsonl`, via `bin/worklog`) with GitHub issues on
  `SpillwaveSolutions/wiki_ticket_sdd_ui`. (Originally tracked in the main
  repo — Rick moved tracking here on 2026-07-22 when the build started; the
  main repo's epic #113/items #114–#121 are closed as moved.)
- **Design changes:** plans are frozen. If the design must change, write a NEW
  superseding plan in the main repo (see its CLAUDE.md), never edit the plan
  or fork the design here. `docs/plans/` in this repo holds pointers only.

## Non-negotiable design rules (from the plan)

1. **Generic by construction.** The target repo is runtime input (CLI arg /
   env / repo picker). Never hardcode paths, repo names, or GitHub coords —
   derive them from the target's `.work/config.yml` and git remotes.
2. **Never reimplement worklog or IA semantics.** Shell out to the target
   repo's own `bin/worklog` (fold, ia-index, trace-check) and read its
   committed `docs/.index/` plane (`_inventory.json`, `_graph.json`,
   `publish-manifest.json`). Do not parse doc frontmatter to classify
   documents — frozen docs keep metadata in sidecars; `_inventory.json` is
   the merged truth.
3. **Read-only guarantee.** This app NEVER writes to the target repo.
   CI enforces it: `npm run check:readonly` (also part of `npm run verify`).
4. **Degrade gracefully.** `gh` CLI when available, unauthenticated REST
   fallback, and full offline function for all file-based panels.

## Dogfood target

Develop and verify against `../wiki_ticket_sdd` (the real repo this was born
from), plus a fresh `init.sh`-scaffolded throwaway repo for the generic-repo
proof. The plan's Verification section lists the acceptance checks.

## Testing policy

Never report a UI change done on the strength of typecheck/build alone.
Preferred ladder (see also [`DESKTOP.md`](./DESKTOP.md)):

1. **`npm run verify`** — typecheck + vitest (server + web, including Tauri
   `mockIPC` paths in `web/src/lib/api.test.ts`) + Playwright e2e against a
   scratch fixture (`e2e/`).
2. **`npm run smoke`** — optional headless load + screenshot when a dev
   server is already up (`npm run dev -- --repo <dogfood>`).
3. **Exploratory UI** — `agent-browser` against the HTTP UI when you need to
   poke at something e2e does not cover.

Notes:

- **Desktop (Tauri) changes:** there is no tool here that can click a native
  window. Drive the same React UI over HTTP (`npm run dev` / `npm start`)
  instead. Tauri-only code paths are unit-tested with
  `@tauri-apps/api/mocks`; for agent-browser, mock
  `window.__TAURI_INTERNALS__` via `eval` (plain async `(cmd, args) => …`
  handler keyed on `cmd` is enough). Read `agent-browser console` after
  interactions.
- **Known environment quirk:** modals use `position: fixed` + `z-50`.
  Coordinate-based `agent-browser` click/screenshot can miss overlay
  content — dispatch `element.click()` via `eval` before calling a bug.
- Ports are dynamic (`scripts/dev-ports.mjs`, bases Vite 8080 / API 4181).
  Do not hardcode 5173. `npm run port` is **read-only** (`--peek`); use
  `npm run port:resolve` only when about to bind. UI origin:
  `npm run port -- --url` (peek + url).
- Rick does one final pass after that — automated verify is what makes
  that pass fast, not a replacement for it.

<!-- worklog:policy:start -->
## Work tracking policy

- Every plan MUST end by running `worklog plan-capture` — it writes
  `docs/plans/<date>-<slug>.md` and appends the plan's steps as work items.
- Work discovered mid-flight that wasn't in the plan: run
  `worklog add --unplanned --discovered-during <item>` BEFORE doing the work.
- Never hand-edit `.work/*.jsonl` (use `worklog`) or `docs/roadmap.md`
  (it is generated; change the work items instead).
- After changing work items, run `worklog roadmap-render` and commit the log
  and roadmap together.
- After changing work items (`add`/`update`/`close`/`reopen`/`link`) OR the
  wiki publish ledger (`.work/published.json`), also run `worklog ia-index`
  before committing. `ia-normalize` back-writes ledger references into doc
  sidecars, so a single pass immediately after one of these operations can
  still leave `docs/.index/` stale — if `git status` still shows index files
  changing after your first `ia-index` run, run it once more before you
  commit (see #16).
<!-- worklog:policy:end -->


## Spillwave UI Guard
See `.claude/UI_GUARD.md` and the skills under `.spillwave/ui-guard/skills/`.
Wireframe-first + adversarial review is required for non-trivial UI work.
Plugin: https://github.com/SpillwaveSolutions/spillwave-ui-guard
