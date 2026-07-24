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
- `ulid.rs` — port `server/src/ulid.ts` (`ulid_timestamp_ms` / `ulid_timestamp_iso`). Required by
  `get_events`: events without an explicit `ts` derive it from the ULID in `ev`. Match the TS
  implementation byte-for-byte (fixture/test vector `01ARZ3NDEKTSV4RRFFQ69G5FAV` →
  `2016-07-30T23:54:10.259Z` per `server/test/events.test.ts` — ignore the outdated comment in
  `fixture.ts` that cites a different ULID-spec example timestamp).
- `commands.rs` — the 13 `#[tauri::command]` fns plus shared helpers: `run()` (mirrors
  `routes.ts`'s `run()`), `sha256_12()`, `count_trace_check_gaps()` (mirrors
  `countTraceCheckGaps`), and `read_jsonl_events()`. Command classification (13 total):
  - **7 shaped responses** (own `#[derive(Serialize)]` structs): `get_repo`, `get_roadmap`,
    `get_git_log`, `get_releases`, `get_trace_check`, `get_wiki_ledger`, `get_events`.
  - **1 shell-out JSON passthrough**: `get_items` — parse `bin/worklog fold` stdout into
    `serde_json::Value` and return it untouched (no `WorklogItem` struct).
  - **5 raw file passthroughs**: `get_docs`, `get_graph`, `get_manifest`, `get_sync` return
    `serde_json::Value` from file bytes via `serde_json::from_str` only so Tauri can ship JSON
    (semantically equivalent to Node's `readJsonVerbatim` — do not reshape fields);
    `get_doc_content` returns `String`. Missing files → `CmdError` status 404 with the same
    `not found: <basename>` message Node uses.
  Do not pre-build typed structs for inventory/graph/manifest/sync/items; that would be more
  code than Node needs and risks silently dropping/reordering fields.
- `state.rs` — `AppState { repo: Mutex<Option<PathBuf>> }`, starts **empty** (no cwd fallback —
  a GUI app has no meaningful cwd; show the picker instead). Optional: if `WORKLOG_REPO` is set
  and validates, seed state from it at startup (mirrors Node's env fallback; useful for
  `tauri dev` dogfood) — never a hardcoded path.
- `error.rs` — `CmdError { status: u16, message: String }` with `#[derive(Serialize)]` (and
  `Debug`/`Display` as Tauri requires), returned by every command's `Result<T, CmdError>`.
  Serialized shape on the wire must be `{ status, message }` so `toApiError` can rebuild
  `ApiError` — this is what makes the 4 panels' 404-as-empty-state branches work under Tauri.
- `main.rs` — wires the dialog plugin, manages `AppState`, registers all commands.

### 3. Repo selection

- `pick_repo` (opens native folder dialog via `tauri-plugin-dialog`, validates via
  `repo::load_target_repo`, stores path in `AppState`, returns `RepoInfo`) and `set_repo(path)`
  (same validate+store without the dialog, for re-selecting a remembered path) both call one
  shared `apply_repo_path()` helper.
- All 13 read commands (including `get_repo`) pull the current path via a `require_repo(&state)`
  helper — same shape as Hono's per-request `c.get("repoPath")` middleware, just triggered by
  "nothing picked yet" instead of "config.yml missing at cwd." When empty, return
  `CmdError { status: 400, message: "no repo selected" }` (or similar fixed string).
- **First-launch UX (Tauri only):** TopBar currently opens the picker only on button click. With
  empty `AppState`, every panel would error until the user finds "Repo". In Tauri mode, auto-open
  `RepoPickerModal` when `getRepo()` fails with the no-repo-selected error (or when
  `repoState.status === "error"` on first load). Browser mode stays click-to-open.

### 4. `web/src/lib/api.ts` transport branch

- `export const isTauri = () => "__TAURI_INTERNALS__" in window;`
- `getJson`/`getText` gain a Tauri command name (+ optional `args` object) and branch:
  `invoke(cmd, args)` under Tauri, existing `fetch()` logic otherwise. Mapping (command name →
  args): most take none; `get_doc_content` → `{ path }`; `get_git_log` → `{ limit }` (optional);
  `set_repo` → `{ path }`. Public `api.getX()` surface panels call stays unchanged — only the
  internals of each method and the two new Tauri-only methods (`pickRepo`, `setRepo`) change.
- `toApiError(e)` translates a rejected `invoke()` (Rust's serialized `CmdError`) back into
  `ApiError(message, status)` — **do not skip this**, it's the only reason the 4 panels' 404-as-
  empty-state branches keep working in the desktop build. Handle both object payloads
  (`{ status, message }`) and stringified JSON (Tauri versions differ in how they surface
  serialized errors).
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
entries become clickable (`api.setRepo(path)`) in Tauri mode only. Copy in the modal should
reflect live switching under Tauri (drop the "set at server launch" wording when `isTauri()`).

### 6. Build order (each step's runnable check — don't skip)

1. Scaffold → `npm run tauri dev` opens a window showing the Vite app (no commands wired yet).
   Ensure `src-tauri/target/` is gitignored (Tauri's own `.gitignore` or root `.gitignore`).
2. `repo.rs` (+ unit tests in the same file or `repo` mod tests) → `cargo test` against the
   literal fixture config string from `server/test/fixture.ts`, plus a missing-config.yml
   rejection case and the quoted-`#`-not-a-comment case (mirrors `server/test/repo.test.ts`).
3. `error.rs` / `run()` / `state.rs` / `ulid.rs` → unit-test ULID vector against
   `server/test/events.test.ts`; a throwaway `ping` command proves the IPC round trip.
4. `get_repo` + `pick_repo`/`set_repo` first (unlocks testing everything else through the real
   UI) → compare returned `RepoInfo` field-for-field against Node's `/api/repo` for the same repo.
5. The 4 raw JSON passthroughs (`get_docs`, `get_graph`, `get_manifest`, `get_sync`) →
   field-equal against Node's equivalent responses (404 shape when file missing).
6. `get_doc_content` → confirm a traversal attempt is rejected with the same 400 shape
   (`Path escapes docs/: …`).
7. `get_items`, `get_events`, `get_roadmap`, `get_git_log`, `get_trace_check` → check against
   fixture-repo expectations already asserted in `server/test/*.test.ts`. Note: the fixture is
   not a git repo, so `get_git_log` / branch fields need either a one-line `git init`+commit in
   the Rust test setup or assertion only against a real dogfood path — don't invent a second
   fixture format.
8. `get_wiki_ledger` last among reads (real join/hash logic) → all three drift states
   (in-sync/pending/source-drift) come out correctly against the fixture
   (`server/test/wiki-ledger.test.ts` oracle).
9. `get_releases` → confirm `gh`-missing triggers the `ureq` fallback, and confirm full-offline
   returns `{offline: true, releases: []}`. When `ticketing.project` is absent, same offline
   empty response (matches Node).
10. Wire `api.ts` transport branch → existing `web/src/lib/api.test.ts` still passes unmodified
    (confirms `isTauri()` is false under Vitest/jsdom).
11. `RepoPickerModal.tsx` + TopBar first-launch auto-open (Tauri mode only).
12. `npm run tauri dev` end-to-end against the dogfood repo `../wiki_ticket_sdd` via the picker —
    walk all 10 panels, compare against `npm run dev` (browser flow) for the same repo.
13. `npm run tauri build` — confirm the bundle launches, the picker works, and confirm via
    `git status --porcelain` on `../wiki_ticket_sdd` before/after a full session that nothing was
    written (the read-only guarantee's acceptance check, not optional). Final review gate:
    `rg 'fs::write|fs::remove_|Command::new\("(git|gh)"' src-tauri/src` should show only
    read-only git/gh invocations (status, log, rev-parse, describe, `gh api` GET).
14. CI: add a `rust` job (or step after Node) in `.github/workflows/ci.yml` that installs the
    stable toolchain via `dtolnay/rust-toolchain@stable` and runs
    `cargo test --manifest-path src-tauri/Cargo.toml`. Full `tauri build` bundling stays a
    manual release-time step to keep CI fast (no Linux system-deps for WebKit in CI unless we
    later need them).

### 7. Parity verification

Reuse `server/test/fixture.ts`'s `buildFixtureRepo()` — don't build a second fixture or a live
two-servers-diffing-JSON harness. Add a small `server/test/build-fixture.ts` CLI shim
(`console.log(buildFixtureRepo())`, run via `npx tsx server/test/build-fixture.ts`) so Rust
integration tests (`src-tauri/tests/parity.rs`) can shell out to get a fresh fixture path, call
the Rust command functions directly (as plain testable functions wrapped by thin
`#[tauri::command]`s — good Rust hygiene independent of this task), and assert the same concrete
values the existing vitest files already assert. Beyond the synthetic fixture, do one manual
side-by-side pass against the real dogfood repo per this repo's own "Dogfood target"
convention — nothing new to invent there either.

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
- `server/src/ulid.ts` — ULID timestamp decode for `get_events` → `src-tauri/src/ulid.rs`
- `web/src/lib/api.ts` — the transport-branch seam
- `web/src/lib/types.ts` — the wire-shape contract (do not fork)
- `web/src/lib/useApi.ts` — `httpStatus` forwarding; do not change, just preserve `ApiError.status`
- `web/src/components/TopBar.tsx` — Tauri first-launch auto-open of the picker
- `server/test/fixture.ts` — the parity fixture to reuse via `server/test/build-fixture.ts`
- `web/src/components/RepoPickerModal.tsx` — needs the Tauri-mode branch
- `.github/workflows/ci.yml` — add `cargo test` job
- `CLAUDE.md` — the four non-negotiable rules above

## Next step

This doc captures the plan only — no code written yet. Per this repo's work-tracking policy,
run `worklog plan-capture` when ready to start execution so this plan's steps get appended to
`.work/todo.jsonl` as tracked work items, then `worklog roadmap-render` and commit log+roadmap
together.
