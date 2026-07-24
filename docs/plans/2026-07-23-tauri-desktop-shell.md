---
date: 2026-07-23
slug: tauri-desktop-shell
title: Tauri 2 desktop shell wrapping the same frontend
epic: 01KY5ZZX8YXD5YDJKQGJ3VCCHN
items: [01KY5ZZX8Z46K7BCSPPFKN23JZ]
---

# Tauri 2 desktop shell (GH #9, item `01KY5ZZX8Z46K7BCSPPFKN23JZ`)

## Context

`worklog:plan-next` shows every item on the frozen plan
(`docs/plans/2026-07-22-wiki-ticket-ui-ia.md`) done except this one: **P3, "Tauri 2 desktop
shell wrapping the same frontend."** It's the last child under the P1 epic
(`01KY5ZZX8YXD5YDJKQGJ3VCCHN`), which can't close until this lands or is explicitly descoped.
The frozen plan (and the superseded 2026-07-21 plan it inherits the line from) states the design
intent explicitly: *"the API layer stays swappable for Tauri's Rust side without touching the
UI."* Confirmed with Rick this task should do the real thing — a full Rust port of the API, not
a Node-sidecar wrap — since that's what the plan's wording was designed to enable and P3/"later"
only meant *sequencing*, not scope-cutting.

There's also a stray orphaned worklog event (`01KY5ZZX`, an `in_progress` update with no
matching item — looks like a truncated ID typo) sitting in `.work/todo.jsonl`. Out of scope for
this plan; flagged separately, not touched here.

## What exists today (verified by exploration)

- `web/` (Vite+React+TS+Tailwind) and `server/` (Hono/Node, plain `tsc`, no bundler) are npm
  workspaces. `web/src/lib/api.ts` is the **only** place `fetch()` is called — every panel goes
  through `api.getX()`. `server/src/routes.ts` (257 lines) is the **entire** API: 13 GET
  endpoints, each a thin `spawnSync` shell-out (git/gh/`python3 bin/worklog`) or raw file read
  under `docs/.index/`/`.work/`, plus light JS joining/sorting in a few handlers.
- `web/src/lib/types.ts` is the hand-kept wire-shape contract for all 13 responses.
- `ApiError.status` is load-bearing: `useApi.ts:31-34` forwards it, and `PublishPlane.tsx`,
  `SyncHealth.tsx`, `Docs.tsx`, `Traceability.tsx` branch on `status === 404` to render empty
  states instead of errors. Any Tauri transport must preserve this.
- `server/src/repo.ts` holds config/YAML/sandbox logic (no shell-outs) — validates
  `.work/config.yml`, hand-rolled flat 2-level YAML parser (deliberately not a full YAML lib —
  comment explains why), doc-path traversal guard.
- Server takes one repo path per process (`--repo`/`WORKLOG_REPO`/cwd) — no live "switch repo"
  endpoint. "Recent repos" is client-only `localStorage` (`web/src/lib/recentRepos.ts`).
- `server/test/fixture.ts` already builds a deterministic throwaway worklog repo used by 6
  vitest files — this is the parity oracle for the Rust port, not something to reinvent.

## Approach: full Rust port, not a Node sidecar

Port all 13 `routes.ts` handlers to Tauri `#[tauri::command]`s that shell out identically
(same binaries/args/cwd as Node's `spawnSync` calls), then branch `web/src/lib/api.ts` to call
`invoke()` instead of `fetch()` under Tauri. Zero UI component changes — the swap lives entirely
inside `api.ts`. This avoids bundling a Node runtime and is what the plan's wording was written
to enable.

### 1. Scaffold

- `src-tauri/` at repo root (sibling to `web/`, `server/`) via `npx @tauri-apps/cli init`.
- `tauri.conf.json`: `frontendDist: "../web/dist"`, `devUrl: "http://localhost:5173"`,
  `beforeDevCommand`/`beforeBuildCommand`: `"npm run -w web dev"` / `"npm run -w web build"`
  (not the root composite scripts — desktop build has no use for the Node server).
- Root `package.json`: add `@tauri-apps/cli` devDependency, `"tauri": "tauri"` script.
- `web/package.json`: add `@tauri-apps/api`, `@tauri-apps/plugin-dialog` dependencies.
- `src-tauri/Cargo.toml`: `tauri`, `tauri-plugin-dialog`, `serde`/`serde_json`, `sha2` (SHA-256,
  no std equivalent), `ureq` (sync HTTP for the releases REST fallback — no async runtime needed
  anywhere since every command is a synchronous shell-out/file read, matching Node's sync
  `spawnSync` usage).
- Capabilities: only `dialog:allow-open`. No `fs:default`/`shell:default` — nothing in the
  frontend needs direct fs/shell access, everything goes through command bodies.

### 2. Rust module layout (`src-tauri/src/`)

- `repo.rs` — port `parseFlatYaml`/`loadTargetRepo`/`resolveDocPath` from `server/src/repo.ts`
  **line-for-line**, not via a real YAML crate. Reasons pinned in review: (a) config.yml is a
  deliberately-flat subset per the Node code's own comment, (b) a real YAML parser could handle
  edge cases differently than the hand-rolled one, which would itself be the exact kind of
  Rust/Node drift this port must avoid, (c) `serde_yaml` is unmaintained.
- `commands.rs` — the 13 `#[tauri::command]` fns plus shared `run()` (mirrors `routes.ts`'s
  `run()`) and `sha256_12()`. Only the 7 handlers that build new response shapes (repo, roadmap,
  git-log, releases, trace-check, wiki-ledger, events) get `#[derive(Serialize)]` structs. The 5
  raw-passthrough endpoints (`docs`, `index/graph`, `index/manifest`, `sync`, `docs/content`)
  return the raw file string/`serde_json::Value` untouched — no reparse, matching Node's
  `readJsonVerbatim` which never reparses either. Do not pre-build typed structs for these; that
  would be more code than Node needs and risks silently dropping/reordering fields.
- `state.rs` — `AppState { repo: Mutex<Option<PathBuf>> }`, starts **empty** (no cwd fallback —
  a GUI app has no meaningful cwd; show the picker instead).
- `error.rs` — `CmdError { status: u16, message: String }`, returned by every command's
  `Result<T, CmdError>`. This is what makes `ApiError.status` parity possible client-side.
- `main.rs` — wires the dialog plugin, manages `AppState`, registers all commands.

### 3. Repo selection

- `pick_repo` (opens native folder dialog via `tauri-plugin-dialog`, validates via
  `repo::load_target_repo`, stores path in `AppState`, returns `RepoInfo`) and `set_repo(path)`
  (same validate+store without the dialog, for re-selecting a remembered path) both call one
  shared `apply_repo_path()` helper.
- All 12 read commands pull the current path via a `require_repo(&state)` helper — same shape as
  Hono's per-request `c.get("repoPath")` middleware, just triggered by "nothing picked yet"
  instead of "config.yml missing at cwd."

### 4. `web/src/lib/api.ts` transport branch

- `export const isTauri = () => "__TAURI_INTERNALS__" in window;`
- `getJson`/`getText` gain a Tauri-command-name parameter and branch: `invoke(cmd, args)` under
  Tauri, existing `fetch()` logic otherwise. Every `api.getX()` call site changes only by adding
  one string argument — the public surface panels call is unchanged.
- `toApiError(e)` translates a rejected `invoke()` (Rust's serialized `CmdError`) back into
  `ApiError(message, status)` — **do not skip this**, it's the only reason the 4 panels' 404-as-
  empty-state branches keep working in the desktop build.
- No new client-side repo-path variable — `RepoInfo.repo_path` (already in `types.ts`) is the
  only place the UI shows it, sourced fresh from each `get_repo()`/`pick_repo()` response.
- After `pick_repo`/`set_repo` succeeds: `window.location.reload()` (Tauri-mode only) to remount
  every panel's `useApi(fetcher, [])` against the new repo — the direct desktop analog of
  relaunching the Node server with a different `--repo`. Don't build a repo-changed event bus for
  this.

### 5. `RepoPickerModal.tsx`

Branch on `isTauri()`. Browser mode: unchanged (display + localStorage "remember" as today).
Tauri mode: a `Choose folder…` button calling a new `api.pickRepo()` (wraps `invoke("pick_repo")`,
Tauri-only, no fetch equivalent needed); on success, `rememberRepo(path)` + reload. Recent-list
entries become clickable (`api.setRepo(path)`) in Tauri mode only.

### 6. Build order (each step's runnable check — don't skip)

1. Scaffold → `npm run tauri dev` opens a window showing the Vite app (no commands wired yet).
2. `repo.rs` → `cargo test` against the literal fixture string from `server/test/fixture.ts`,
   plus a missing-config.yml rejection case (mirrors `server/test/repo.test.ts`).
3. `error.rs`/`run()`/`state.rs` → a throwaway `ping` command proves the IPC round trip.
4. `get_repo` + `pick_repo`/`set_repo` first (unlocks testing everything else through the real
   UI) → compare returned `RepoInfo` field-for-field against Node's `/api/repo` for the same repo.
5. The 4 raw-passthrough commands → byte-diff against Node's equivalent responses.
6. `get_doc_content` → confirm a traversal attempt is rejected with the same 400 shape.
7. `get_items`, `get_events`, `get_roadmap`, `get_git_log`, `get_trace_check` → check against
   fixture-repo expectations already asserted in `server/test/*.test.ts`.
8. `get_wiki_ledger` last among reads (real join/hash logic) → all three drift states
   (in-sync/pending/source-drift) come out correctly against the fixture.
9. `get_releases` → confirm `gh`-missing triggers the `ureq` fallback, and confirm full-offline
   returns `{offline: true, releases: []}`.
10. Wire `api.ts` transport branch → existing `web/src/lib/api.test.ts` still passes unmodified
    (confirms `isTauri()` is false under Vitest/jsdom).
11. `RepoPickerModal.tsx` native-dialog wiring.
12. `npm run tauri dev` end-to-end against the dogfood repo `../wiki_ticket_sdd` via the picker —
    walk all 10 panels, compare against `npm run dev` (browser flow) for the same repo.
13. `npm run tauri build` — confirm the bundle launches, the picker works, and confirm via
    `git status --porcelain` on `../wiki_ticket_sdd` before/after a full session that nothing was
    written (the read-only guarantee's acceptance check, not optional).
14. CI: at minimum `cargo test` should run in CI; full `tauri build` bundling can stay a manual
    release-time step to keep CI fast.

### 7. Parity verification

Reuse `server/test/fixture.ts`'s `buildFixtureRepo()` — don't build a second fixture or a live
two-servers-diffing-JSON harness. Add a 3-line `server/test/build-fixture.ts` CLI shim
(`console.log(buildFixtureRepo())`) so Rust integration tests (`src-tauri/tests/parity.rs`) can
shell out to get a fresh fixture path, call the Rust command functions directly (as plain
testable functions wrapped by thin `#[tauri::command]`s — good Rust hygiene independent of this
task), and assert the same concrete values the existing vitest files already assert. Beyond the
synthetic fixture, do one manual side-by-side pass against the real dogfood repo per this repo's
own "Dogfood target" convention — nothing new to invent there either.

### CLAUDE.md rules that constrain shortcuts (explicit, don't relitigate under time pressure)

1. **Never reimplement worklog/IA semantics** — `get_items` and the 4 passthrough endpoints must
   return unparsed/unvalidated data exactly as `bin/worklog`/the committed JSON files emit it. No
   typed structs for `_inventory.json`/`_graph.json`/`publish-manifest.json`.
2. **Generic by construction** — no hardcoded repo path anywhere, not even "temporarily for dev
   speed." A `WORKLOG_REPO` env fallback would be fine (mirrors Node's own fallback); a literal
   path in `main.rs` would not.
3. **Read-only guarantee** — `resolveDocPath`'s traversal guard ports unchanged regardless of
   "it's the user's own machine now." Final review gate: grep `src-tauri/src/` for any
   `fs::write`/`fs::remove_*`/mutating git or gh calls — there should be none.
4. **Degrade gracefully** — the `gh` → `ureq` REST fallback → offline chain for `get_releases`
   must be ported in full, not simplified to `gh`-only.
5. **Resist a shared-types package.** `web/src/lib/types.ts` already is the documented contract;
   both backends satisfying it independently (verified by the fixture tests) is sufficient — a
   TS+Rust codegen system for 13 rarely-changing types is more machinery than the problem needs.

## Critical files

- `server/src/routes.ts` — the 13-endpoint spec every Rust command must match
- `server/src/repo.ts` — config/YAML/sandbox logic to port into `src-tauri/src/repo.rs`
- `web/src/lib/api.ts` — the transport-branch seam
- `web/src/lib/types.ts` — the wire-shape contract (do not fork)
- `server/test/fixture.ts` — the parity fixture to reuse via `server/test/build-fixture.ts`
- `web/src/components/RepoPickerModal.tsx` — needs the Tauri-mode branch
- `CLAUDE.md` — the four non-negotiable rules above

## Next step

This doc captures the plan only — no code written yet. Per this repo's work-tracking policy,
run `worklog plan-capture` when ready to start execution so this plan's steps get appended to
`.work/todo.jsonl` as tracked work items, then `worklog roadmap-render` and commit log+roadmap
together.
