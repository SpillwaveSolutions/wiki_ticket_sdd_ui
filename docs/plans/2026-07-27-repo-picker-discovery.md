---
date: 2026-07-27
slug: repo-picker-discovery
title: Repo picker: local-root scanning + GitHub org search + shallow-clone cache
epic: 01KYJYCFCCFT3PJV6FP99AEWSS
items: [01KYJYCFCCF4MS6GAG2YQE82BJ, 01KYJYCFCC843N3DX38Q9JA13F, 01KYJYCFCC5V94FMQJDZ0FZ2AS, 01KYJYCFCD0KTXXFHMVRTRC3VX, 01KYJYCFCD9JAQD5BGPCCCE82T]
---

# Repo picker: local-root scanning + GitHub org search + shallow-clone cache

## Context

The desktop app's "Repo" picker (`web/src/components/RepoPickerModal.tsx`) currently only
offers a native folder dialog (`pick_repo`) or re-selecting a remembered path (`set_repo`) —
both `src-tauri/src/commands.rs`, both requiring the folder to already be a valid,
already-cloned worklog repo (`load_target_repo` in `src-tauri/src/repo.rs` checks for
`.work/config.yml`). There's no way to discover repos: not ones already cloned somewhere on
disk under a directory you don't remember exactly, and not ones on GitHub you haven't cloned
at all. The app already shells out to `gh` for releases (`build_releases`, preferring `gh`
CLI with an unauthenticated REST fallback) — this extends that same "degrade gracefully"
pattern to repo discovery.

Confirmed with the user:
- Auto-clone not-yet-local repos into a managed cache directory, using a **shallow clone**
  (`--depth 1`) by default, plus a way to **clean** (remove) cached clones.
- Also scan **configured local root directories** (folders that contain many repo checkouts,
  e.g. `~/src`, `~/clients/<client>/src`) for repos already on disk — a second, independent
  discovery path, not merged/deduped against the GitHub list.
- GitHub search scope: your accessible repos, filterable by org (`gh repo list <org>`), not
  full GitHub-wide search.
- Filter results to repos that actually look worklog-enabled (`.work/config.yml` present),
  checked progressively per-candidate.
- Root-directory list and app-level settings persist at `~/.config/wicked_ticket/config.json`
  — new, app-level (not per-target-repo) config, distinct from any target repo's own
  `.work/config.yml`. Ships with an empty `repo_roots` default; Rick's own example roots are
  seeded into his personal config file directly, not hardcoded into source.

This is Tauri-only (native filesystem scan + `git`/`gh` shell-out + local dialog) — same
scope boundary as the existing `pick_repo`/`set_repo` commands, already Tauri-only.

**Read-only guarantee unaffected**: target repos with `.work/config.yml` are still never
written to. Shallow-cloning a not-yet-local repo writes only into the app's own managed cache
directory — a fresh acquisition, not a mutation of existing tracked content.

## Design

- New Rust module `src-tauri/src/appconfig.rs`: app config load/save, repo-root CRUD, local
  repo scanning (one level deep per root, `.git` + `.work/config.yml` checks), managed
  shallow-clone cache directory helpers, and cache cleanup with a guard that refuses to
  delete anything outside the managed cache root.
- ~11 new Tauri commands in `src-tauri/src/commands.rs` (registered in `lib.rs`): repo-root
  list/add/remove/pick, local scan, GitHub org listing (`gh api user/orgs` + personal login),
  org repo listing (`gh repo list <org>`, fast, no worklog check yet), a per-repo
  `.work/config.yml` existence check (`gh api repos/.../contents/.work/config.yml`, called
  progressively per-candidate from the frontend with capped concurrency), shallow clone via
  `gh repo clone <owner>/<name> <dest> -- --depth 1` (inherits `gh`'s own auth), cache
  listing, and cache cleanup.
- Frontend: new `LocalRepoCandidate`/`GhRepoCandidate`/`CachedRepoInfo` types, Tauri-only
  `api.*` wrappers following the existing `pickRepo`/`setRepo` pattern, a small tab bar
  (Recent / Local / GitHub) added to `RepoPickerModal.tsx`, and two new components —
  `LocalRootsPanel.tsx` (root management + scanned local repo list) and
  `GithubRepoPanel.tsx` (org picker, progressively-filtered repo list, clone action, cache
  management).

Explicit scope cuts: no cross-referencing/dedup between local-scan and GitHub-search results,
local scan is one level deep only, org repo listing caps at 200 with no pagination, no
Windows-specific config-dir handling.

## Tasks

- [ ] (P2) Write src-tauri/src/appconfig.rs
  New module: config_path/cache_root resolution against `$HOME/.config/wicked_ticket/`,
  AppConfig load/save, add_root/remove_root with dedup, scan_local_repos (one level deep,
  `.git` + `.work/config.yml` checks), list_cached_repos, and clean_cache with a guard that
  refuses to delete anything outside the managed cache root. Includes tempdir-based unit
  tests mirroring repo.rs's existing style.

- [ ] (P2) Add repo-discovery Tauri commands and register them
  Add list_repo_roots, add_repo_root, remove_repo_root, pick_repo_root, scan_local_repos,
  list_gh_orgs, list_org_repos, check_worklog_enabled, clone_repo, list_cached_repos, and
  clean_repo_cache to commands.rs, reusing the existing run()/apply_repo_path helpers, and
  register all of them in lib.rs's generate_handler! list.

- [ ] (P2) Add frontend types and api.ts methods for the new commands
  Add LocalRepoCandidate, GhRepoCandidate, and CachedRepoInfo types to types.ts, and
  Tauri-only wrapper methods in api.ts for every new command, following the exact
  pickRepo/setRepo isTauri()-guard pattern already in the file.

- [ ] (P2) Build the repo-picker UI: tabs, local-roots panel, GitHub search panel
  Add a small Recent/Local/GitHub tab bar to RepoPickerModal.tsx without disturbing the
  existing Recent-list and browser-mode manual-path behavior, and build two new components:
  LocalRootsPanel.tsx (add/remove root directories, list scanned worklog-enabled repos) and
  GithubRepoPanel.tsx (org dropdown, repo list with progressive worklog-enabled filtering via
  capped-concurrency checks, a clone-and-open action, and cache management).

- [ ] (P2) Verify end to end and seed local config
  Run cargo test --manifest-path src-tauri/Cargo.toml and npm run typecheck across both
  workspaces, seed ~/.config/wicked_ticket/config.json with Rick's real local repo roots
  (~/src, ~/clients/ao/src, ~/clients/spillwave/src, ~/clients/gulfwinds/src), then manually
  verify in the running tauri dev session: Local tab lists worklog-enabled repos, GitHub tab
  lists orgs/repos filtering down correctly, clone-and-open works end to end, and cache
  cleanup empties the managed cache directory.
