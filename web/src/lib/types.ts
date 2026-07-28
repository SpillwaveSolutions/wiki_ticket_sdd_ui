// Types for every /api/* response. Shapes verified against server/src/routes.ts
// and the real dogfood repo's committed docs/.index/* + .work/* files — see
// docs/plans/2026-07-22-wiki-ticket-ui-ia.md "Updated data contract".
//
// Panel agents: read this file, never edit it here — if a panel needs a field
// this file doesn't have, add it here (it's shared), but keep the shape
// additive so other panels don't break.

export type ItemStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export type ItemLevel = "epic" | "story" | "task" | "subtask";
export type ItemKind = "feature" | "bug" | "ops" | "triage";
export type TruthState = "current" | "snapshot" | "superseded" | "archived";

/** One row of `python3 bin/worklog fold` output (GET /api/items). */
export interface WorklogItem {
  id: string;
  title: string;
  status: ItemStatus;
  priority?: string;
  level?: ItemLevel;
  kind?: ItemKind;
  parent?: string;
  milestone?: string;
  plan?: string;
  resolution?: string;
  depends_on?: string[];
  labels?: string[];
  unplanned?: boolean;
  discovered_during?: string;
  /** Real shape from `bin/worklog fold`/sync; not schema-enforced, so
   * lib/external.ts's normalizeExternal() also tolerates legacy shapes. */
  external?: { system?: string; key?: string | number; url?: string; hash?: string; synced_at?: string };
  _orphan?: boolean;
  _conflicts?: string[];
}

/** One line of .work/todo.jsonl or done.jsonl (GET /api/events). */
export interface WorklogEvent {
  ev: string;
  item: string;
  op: "create" | "close" | "link" | "snapshot" | "compact";
  set?: Record<string, unknown>;
  through?: string;
  ts?: string;
  actor?: string;
}

/** GET /api/repo */
export interface RepoInfo {
  name: string | null;
  key: string | null;
  repo_path: string;
  github_project: string | null;
  wiki_root_url: string | null;
  branch: string | null;
  latest_tag: string | null;
  installed_version: string | null;
  worklog_version: string | null;
  drift: { dirty: boolean; version_skew: boolean };
}

/** GET /api/roadmap */
export interface RoadmapResponse {
  meta: Record<string, string>;
  markdown: string;
}

/** One entry of docs/.index/_inventory.json's `docs` array (GET /api/docs). */
export interface InventoryDoc {
  wiki_key: string;
  canonical_key?: string;
  aliases?: string[];
  doc_type: string;
  title: string;
  source: string;
  status?: string;
  truth_state: TruthState;
  supersedes?: string;
  superseded_by?: string;
  tags?: string[];
  date?: string;
  problems?: string[];
  [key: string]: unknown;
}

export interface InventoryResponse {
  version: number;
  docs: InventoryDoc[];
}

/** GET /api/index/graph — docs/.index/_graph.json */
export interface GraphNode {
  doc_type?: string;
  source?: string;
  title?: string;
  truth_state?: TruthState;
  [key: string]: unknown;
}

export type GraphEdgeType =
  | "produces"
  | "belongs-to"
  | "targets"
  | "references"
  | "lands-in"
  | "supersedes"
  | "snapshot-of"
  | "relates-to";

export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
}

export interface GraphResponse {
  version: number;
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
}

/** GET /api/index/manifest — docs/.index/publish-manifest.json */
export interface ManifestPage {
  wiki_key: string;
  page_name: string;
  title: string;
  source: string;
  render: string;
  render_hash: string;
  frozen: boolean;
  truth_state: TruthState;
}

export interface ManifestResponse {
  version: number;
  pages: ManifestPage[];
  sidebar?: { source: string; render_hash: string };
}

/** GET /api/wiki-ledger — .work/published.json joined with a computed 3-way drift. */
export type WikiDrift = "in-sync" | "pending" | "source-drift" | "unknown";

export interface WikiLedgerEntry {
  rev: string;
  source: string;
  source_hash: string;
  render_hash: string;
  url: string;
  title: string;
  wiki_key: string;
  canonical_key?: string;
  aliases?: string[];
  doc_type?: string;
  truth_state?: TruthState;
  drift: WikiDrift;
}

export type WikiLedgerResponse = Record<string, WikiLedgerEntry>;

/** GET /api/sync — .work/sync-state.json */
export interface SyncState {
  adapter_path?: string;
  cursors?: Record<string, string>;
  items?: Record<string, { last_push?: string; last_pushed_hash?: string }>;
  _conflicts?: unknown[];
  [key: string]: unknown;
}

/** GET /api/git/log */
export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  subject: string;
}

/** GET /api/releases — a GitHub release, loosely typed (upstream shape). */
export interface Release {
  tag_name: string;
  name?: string;
  published_at?: string;
  html_url?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  [key: string]: unknown;
}

export interface ReleasesResponse {
  offline: boolean;
  releases: Release[];
}

/** GET /api/trace-check */
export interface TraceCheckResponse {
  ok: boolean;
  output: string;
  /** Count of unlinked-evidence gap lines in `output`, parsed server-side —
   * same rule as traceability-graph.ts's parseTraceCheck(), which the panel
   * still uses for the gap list itself (this field is just the count). */
  gaps: number;
}

/** Tauri-only: scan_local_repos — a repo found under a configured root directory. */
export interface LocalRepoCandidate {
  path: string;
  name: string;
  worklog_enabled: boolean;
}

/** Tauri-only: list_org_repos — a repo candidate from `gh repo list`, worklog
 * status resolved separately (and progressively) via check_worklog_enabled. */
export interface GhRepoCandidate {
  owner: string;
  name: string;
  description: string | null;
  is_private: boolean;
}

/** Tauri-only: list_cached_repos — a repo cloned into the managed shallow-clone cache. */
export interface CachedRepoInfo {
  owner: string;
  name: string;
  path: string;
}
