// Typed fetch helpers for every server endpoint (server/src/routes.ts).
// All browser requests go to relative /api/* paths — the Vite dev server proxies
// them to the Hono server (see vite.config.ts); the production build is
// served by the same server, so relative paths work there too.
//
// Under Tauri, the same public api.* surface calls invoke() against the Rust
// port instead of fetch(). Panels never branch on transport.

import { invoke } from "@tauri-apps/api/core";
import type {
  GitCommit,
  GraphResponse,
  InventoryResponse,
  ManifestResponse,
  ReleasesResponse,
  RepoInfo,
  RoadmapResponse,
  SyncState,
  TraceCheckResponse,
  WikiLedgerResponse,
  WorklogEvent,
  WorklogItem,
} from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** True when running inside the Tauri webview (Tauri 2 sets this global). */
export const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Translate a rejected invoke() payload back into ApiError(status). */
function toApiError(e: unknown): ApiError {
  // Object form (Serialize of CmdError)
  if (e && typeof e === "object") {
    const obj = e as { status?: unknown; message?: unknown };
    if (typeof obj.status === "number" && typeof obj.message === "string") {
      return new ApiError(obj.message, obj.status);
    }
    // Sometimes nested under a message/error field as JSON string
    const raw =
      typeof (e as { message?: unknown }).message === "string"
        ? (e as { message: string }).message
        : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { status?: unknown; message?: unknown };
        if (typeof parsed.status === "number" && typeof parsed.message === "string") {
          return new ApiError(parsed.message, parsed.status);
        }
      } catch {
        // not JSON
      }
      return new ApiError(raw, 500);
    }
  }
  if (typeof e === "string") {
    try {
      const parsed = JSON.parse(e) as { status?: unknown; message?: unknown };
      if (typeof parsed.status === "number" && typeof parsed.message === "string") {
        return new ApiError(parsed.message, parsed.status);
      }
    } catch {
      // plain string
    }
    return new ApiError(e, 500);
  }
  return new ApiError(e instanceof Error ? e.message : String(e), 500);
}

async function getJson<T>(url: string, cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    try {
      return await invoke<T>(cmd, args ?? {});
    } catch (e) {
      throw toApiError(e);
    }
  }
  const res = await fetch(url);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.error ?? detail;
    } catch {
      // response wasn't JSON — keep statusText
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

async function getText(url: string, cmd: string, args?: Record<string, unknown>): Promise<string> {
  if (isTauri()) {
    try {
      return await invoke<string>(cmd, args ?? {});
    } catch (e) {
      throw toApiError(e);
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(res.statusText, res.status);
  return res.text();
}

export const api = {
  getRepo: () => getJson<RepoInfo>("/api/repo", "get_repo"),
  getItems: () => getJson<WorklogItem[]>("/api/items", "get_items"),
  getEvents: () => getJson<WorklogEvent[]>("/api/events", "get_events"),
  getRoadmap: () => getJson<RoadmapResponse>("/api/roadmap", "get_roadmap"),
  getDocs: () => getJson<InventoryResponse>("/api/docs", "get_docs"),
  getDocContent: (path: string) =>
    getText(`/api/docs/content?path=${encodeURIComponent(path)}`, "get_doc_content", { path }),
  getGraph: () => getJson<GraphResponse>("/api/index/graph", "get_graph"),
  getManifest: () => getJson<ManifestResponse>("/api/index/manifest", "get_manifest"),
  getWikiLedger: () => getJson<WikiLedgerResponse>("/api/wiki-ledger", "get_wiki_ledger"),
  getSync: () => getJson<SyncState>("/api/sync", "get_sync"),
  getGitLog: (limit?: number) =>
    getJson<GitCommit[]>(
      `/api/git/log${limit ? `?limit=${limit}` : ""}`,
      "get_git_log",
      limit !== undefined ? { limit } : {},
    ),
  getReleases: () => getJson<ReleasesResponse>("/api/releases", "get_releases"),
  getTraceCheck: () => getJson<TraceCheckResponse>("/api/trace-check", "get_trace_check"),

  /** Tauri-only: native folder dialog + validate + store. */
  pickRepo: async (): Promise<RepoInfo> => {
    if (!isTauri()) {
      throw new ApiError("pickRepo is only available in the desktop app", 400);
    }
    try {
      return await invoke<RepoInfo>("pick_repo");
    } catch (e) {
      throw toApiError(e);
    }
  },

  /** Tauri-only: re-select a remembered path. */
  setRepo: async (path: string): Promise<RepoInfo> => {
    if (!isTauri()) {
      throw new ApiError("setRepo is only available in the desktop app", 400);
    }
    try {
      return await invoke<RepoInfo>("set_repo", { path });
    } catch (e) {
      throw toApiError(e);
    }
  },
};
