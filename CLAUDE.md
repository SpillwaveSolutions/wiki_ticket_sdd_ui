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
4. **Degrade gracefully.** `gh` CLI when available, unauthenticated REST
   fallback, and full offline function for all file-based panels.

## Dogfood target

Develop and verify against `../wiki_ticket_sdd` (the real repo this was born
from), plus a fresh `init.sh`-scaffolded throwaway repo for the generic-repo
proof. The plan's Verification section lists the acceptance checks.

## Testing policy

Never report a UI change done on the strength of typecheck/build/unit tests
alone — those verify the code compiles, not that the feature works. Before
telling Rick something is ready for his own pass, actually drive it:

- **Desktop (Tauri) changes:** there is no tool in this environment that can
  click through a native window. Test the same React UI served over HTTP
  instead (`npm start -- --repo <dogfood repo>`, port 4181) using the
  `agent-browser` CLI (`agent-browser open/snapshot/eval/...`). Tauri-only
  code paths (anything gated on `isTauri()`) need `window.__TAURI_INTERNALS__`
  mocked via `eval` before opening the picker — `@tauri-apps/api/mocks.js`
  documents the exact shape (`invoke`, `transformCallback`, ...); a plain
  `async (cmd, args) => {...}` handler keyed on `cmd` is enough. Read the
  console log (`agent-browser console`) after each interaction to confirm the
  right command actually fired with the right args, not just that the UI
  looked right.
- **Known environment quirk:** this app's modals use `position: fixed` +
  `z-50` overlays. In this session, `agent-browser`'s coordinate-based
  `click`/`screenshot` couldn't reliably hit or render elements *inside* such
  an overlay (elements outside it worked fine) — verified by dispatching a
  real `element.click()` via `eval`, which worked correctly every time.
  If a click-by-ref silently does nothing inside a fixed overlay, that's this
  quirk, not necessarily an app bug — confirm with a direct DOM `.click()`
  before concluding something is broken.
- Rick does one final pass after that — testing first is what makes that
  pass fast, not a replacement for it. (This rule exists because a real,
  previously-unnoticed bug — a relative `--repo` path resolving against the
  wrong directory under `npm run -w server` — was only caught by actually
  loading the app in a browser, not by any of typecheck/build/unit tests.)

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
