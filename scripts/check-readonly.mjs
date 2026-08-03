#!/usr/bin/env node
/**
 * CI gate for the read-only guarantee (CLAUDE.md rule 3 / design §22):
 * this app must never write to the *target* worklog repo.
 *
 * Allowed writes (not the target):
 *   - src-tauri/src/appconfig.rs — app config under ~/.config/wicked_ticket/
 *     and the managed shallow-clone cache (create / clean only inside cache_root)
 *   - src-tauri/src/commands.rs clone_repo — create_dir_all under cache +
 *     `gh repo clone … --depth 1` into that cache
 *   - #[cfg(test)] modules and server/test/** fixtures
 *
 * Usage: node scripts/check-readonly.mjs
 * Exit 0 = clean, 1 = violation(s).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const violations = [];

function walk(dir, pred, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "target" || name === "dist") continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, pred, out);
    else if (pred(full)) out.push(full);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p);
}

function add(file, line, lineNo, why) {
  violations.push(`${rel(file)}:${lineNo}: ${why}\n  → ${line.trim()}`);
}

// ── 1. Node server production sources: zero filesystem writes ──────────────

const NODE_WRITE =
  /\b(writeFileSync|writeFile|appendFileSync|appendFile|rmSync|rmdirSync|unlinkSync|mkdirSync|renameSync|copyFileSync|createWriteStream|promises\.writeFile|openSync\s*\([^)]*['"]w)\b/;

for (const file of walk(path.join(ROOT, "server", "src"), (f) => f.endsWith(".ts"))) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
    if (NODE_WRITE.test(line)) {
      add(file, line, i + 1, "server/src must not write the filesystem (target repo is read-only)");
    }
  });
}

// ── 2. Rust production sources: no writes except appconfig + clone cache ───

// Patterns that mutate the filesystem. create_dir_all is allowed only where
// the clone cache is prepared (commands.rs); everything else is deny.
const RUST_WRITE = /\b(fs::write|fs::remove_|fs::copy|fs::rename|File::create|OpenOptions::new)\b/;
const RUST_CREATE_DIR = /\bfs::create_dir(?:_all)?\b/;

/**
 * Strip #[cfg(test)] modules / functions so fixture setup does not fail the gate.
 * Tracks brace depth after a #[cfg(test)] annotation on a following item.
 */
function productionLines(source) {
  const lines = source.split("\n");
  const out = []; // { line, lineNo }
  let skipDepth = 0; // >0 means inside a cfg(test) item
  let pendingTestAttr = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (skipDepth === 0) {
      if (/#\[cfg\(test\)\]/.test(trimmed)) {
        pendingTestAttr = true;
        continue;
      }
      if (pendingTestAttr) {
        // skip attributes stacked on the same item, then the item itself
        if (trimmed.startsWith("#[")) continue;
        if (trimmed === "" || trimmed.startsWith("//")) continue;
        pendingTestAttr = false;
        // enter the item — count braces on this and following lines
        const opens = (line.match(/\{/g) || []).length;
        const closes = (line.match(/\}/g) || []).length;
        if (opens === 0 && closes === 0) {
          // single-line item without braces (e.g. type alias) — already skipped
          continue;
        }
        skipDepth = opens - closes;
        if (skipDepth <= 0) {
          skipDepth = 0; // one-liner with balanced braces
        }
        continue;
      }
      out.push({ line, lineNo: i + 1 });
    } else {
      const opens = (line.match(/\{/g) || []).length;
      const closes = (line.match(/\}/g) || []).length;
      skipDepth += opens - closes;
      if (skipDepth <= 0) skipDepth = 0;
    }
  }
  return out;
}

const rustFiles = walk(path.join(ROOT, "src-tauri", "src"), (f) => f.endsWith(".rs"));
for (const file of rustFiles) {
  const base = path.basename(file);
  // appconfig.rs owns the only intentional non-target writes (config + cache).
  if (base === "appconfig.rs") continue;

  const prod = productionLines(readFileSync(file, "utf8"));
  for (const { line, lineNo } of prod) {
    if (line.trimStart().startsWith("//")) continue;

    if (RUST_WRITE.test(line)) {
      add(
        file,
        line,
        lineNo,
        "fs write/remove outside appconfig.rs — would risk the target repo",
      );
      continue;
    }

    if (RUST_CREATE_DIR.test(line)) {
      // Only clone_repo may prepare the managed cache parent directory.
      if (base === "commands.rs" && /create_dir_all\(parent\)/.test(line)) {
        continue;
      }
      add(
        file,
        line,
        lineNo,
        "create_dir outside appconfig/clone cache — not allowed on target paths",
      );
    }
  }
}

// ── 3. Shell-outs: only read-only git / gh / worklog subcommands ────────────

// First argv after "git" that mutates a working tree or remote.
const GIT_MUTATE =
  /\b(?:run|spawnSync|Command::new)\s*\(\s*["']git["']\s*,\s*(?:&)?\[[^\]]*\b(?:add|commit|push|pull|checkout|reset|clean|rebase|merge|rm|mv|stash|cherry-pick|revert|tag|branch|init|remote|config|submodule|worktree|restore|switch)\b/;

// worklog ops that write .work/*.jsonl — fold / trace-check / --version only.
const WORKLOG_MUTATE =
  /["']bin\/worklog["']\s*,\s*["'](?:add|update|close|reopen|link|ingest|conflict|resolve|wiki-add|plan-capture|compact|promote|sync|adapter|adr|ia-normalize|ia-render|ia-manifest|ia-index|ia-graph|ia-inventory|roadmap-render|roadmap-snapshot)["']/;

// gh mutations against GitHub state (clone into managed cache is allowed).
const GH_MUTATE =
  /\b(?:run|spawnSync)\s*\(\s*["']gh["']\s*,\s*(?:&)?\[[^\]]*\b(?:issue|pr|release|gist|label|project|workflow|secret|variable|api)\b[^;\n]*\b(?:POST|PUT|PATCH|DELETE|--method\s+POST)\b/;

// Simpler gh check: ban obvious write subcommands; allow api (GET), repo list/clone, auth.
const GH_WRITE_SUBCMD =
  /["']gh["']\s*,\s*(?:&)?\[\s*["'](?:issue|pr|release|gist|label|project|secret|variable|codespace|run)["']/;

const shellFiles = [
  ...walk(path.join(ROOT, "server", "src"), (f) => f.endsWith(".ts")),
  ...walk(path.join(ROOT, "src-tauri", "src"), (f) => f.endsWith(".rs")),
];

for (const file of shellFiles) {
  // appconfig has no shell-outs of interest; still scan commands/routes
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;

    if (GIT_MUTATE.test(line)) {
      add(file, line, i + 1, "mutating git subcommand — target repo must stay read-only");
    }
    if (WORKLOG_MUTATE.test(line)) {
      add(file, line, i + 1, "mutating worklog op — target repo must stay read-only");
    }
    if (GH_WRITE_SUBCMD.test(line)) {
      // allow only if it's clearly `gh api` (read) — already excluded by subcmd list
      add(file, line, i + 1, "mutating gh subcommand — not part of the read-only surface");
    }
    if (GH_MUTATE.test(line)) {
      add(file, line, i + 1, "gh API mutation method — not allowed");
    }
  });
}

// ── 4. Explicit ban: gh repo clone must only appear next to cache_root ─────
// (clone is allowed, but not into an arbitrary path). Soft check: every
// `repo", "clone"` / `repo', 'clone'` co-occurs with cache_root/dest in the
// same function — already true today; we just ensure clone exists only in
// commands.rs.

for (const file of rustFiles) {
  if (path.basename(file) === "commands.rs") continue;
  if (path.basename(file) === "appconfig.rs") continue;
  const prod = productionLines(readFileSync(file, "utf8"));
  for (const { line, lineNo } of prod) {
    if (/repo["']\s*,\s*["']clone["']/.test(line) || /gh repo clone/.test(line)) {
      add(file, line, lineNo, "gh repo clone outside commands.rs clone_repo");
    }
  }
}

// ── report ─────────────────────────────────────────────────────────────────

if (violations.length === 0) {
  console.log("check-readonly: ok — no target-repo write surface found");
  process.exit(0);
}

console.error(`check-readonly: ${violations.length} violation(s):\n`);
for (const v of violations) console.error(`  ${v}\n`);
console.error(
  "This app is read-only over the target worklog repo.\n" +
    "Allowed writes: appconfig (config + clone cache) and clone_repo into that cache.\n" +
    "See docs/plans/2026-07-23-tauri-desktop-shell.md §6 step 13 and design §22.",
);
process.exit(1);
