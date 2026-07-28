// Target-repo resolution + a tiny hand-rolled parser for .work/config.yml
// (flat two-level YAML — no dependency needed for that).
import fs from "node:fs";
import path from "node:path";

export class TargetRepoError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface WorklogConfig {
  project: { key?: string; name?: string };
  ticketing: { system?: string; project?: string };
  wiki: { system?: string; root_url?: string };
  paths: { plans?: string; status?: string; roadmap?: string };
  installed?: string;
  [key: string]: unknown;
}

/** Strip a `#` comment that starts outside any quoted string. */
function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "#") {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(v: string): string {
  if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'"))) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Parses a flat, two-level-deep YAML subset: top-level `key:` sections
 * containing indented `subkey: value` scalars, plus top-level `key: value`
 * scalars. Anything deeper (lists, block scalars) is ignored — config.yml
 * never needs it for the fields this server reads.
 */
export function parseFlatYaml(text: string): Record<string, any> {
  const result: Record<string, any> = {};
  let section: string | null = null;
  for (const rawLine of text.split("\n")) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) continue;
    const line = stripComment(rawLine);
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (indent === 0) {
      if (value === "") {
        section = key;
        result[key] = {};
      } else {
        section = null;
        result[key] = unquote(value);
      }
    } else if (section) {
      if (value === "") continue; // deeper nesting / lists — not needed here
      if (typeof result[section] !== "object" || result[section] === null) result[section] = {};
      result[section][key] = unquote(value);
    }
  }
  return result;
}

export function resolveRepoPath(candidate?: string): string {
  // npm workspace scripts (`npm start` -> `npm run -w server start --`) run
  // with cwd set to server/, not the directory the user invoked npm from —
  // a bare path.resolve(candidate) then resolves a relative --repo against
  // the wrong directory. npm always sets INIT_CWD to the real invocation
  // directory; fall back to cwd for direct `node dist/index.js` invocation.
  const baseDir = process.env.INIT_CWD || process.cwd();
  return path.resolve(baseDir, candidate || process.env.WORKLOG_REPO || baseDir);
}

/** A valid target has `.work/config.yml` at its root. Throws otherwise. */
export function loadTargetRepo(repoPath: string): { repoPath: string; config: WorklogConfig } {
  const configPath = path.join(repoPath, ".work", "config.yml");
  if (!fs.existsSync(configPath)) {
    throw new TargetRepoError(
      `Not a worklog repo: ${repoPath} (missing .work/config.yml)`,
      400,
    );
  }
  const raw = fs.readFileSync(configPath, "utf8");
  const config = parseFlatYaml(raw) as WorklogConfig;
  return { repoPath, config };
}

/** Resolves a doc path (as it appears in the inventory, e.g. "docs/adr/x.md")
 * against the repo root and refuses anything that escapes the repo's docs/ dir. */
export function resolveDocPath(repoPath: string, requested: string): string {
  const docsRoot = path.resolve(repoPath, "docs") + path.sep;
  const resolved = path.resolve(repoPath, requested);
  if (!resolved.startsWith(docsRoot)) {
    throw new TargetRepoError(`Path escapes docs/: ${requested}`, 400);
  }
  return resolved;
}
