// Typed fetch helpers for every server endpoint (server/src/routes.ts).
// All requests go to relative /api/* paths — the Vite dev server proxies
// them to the Hono server (see vite.config.ts); the production build is
// served by the same server, so relative paths work there too.

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

async function getJson<T>(url: string): Promise<T> {
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

async function getText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new ApiError(res.statusText, res.status);
  return res.text();
}

export const api = {
  getRepo: () => getJson<RepoInfo>("/api/repo"),
  getItems: () => getJson<WorklogItem[]>("/api/items"),
  getEvents: () => getJson<WorklogEvent[]>("/api/events"),
  getRoadmap: () => getJson<RoadmapResponse>("/api/roadmap"),
  getDocs: () => getJson<InventoryResponse>("/api/docs"),
  getDocContent: (path: string) => getText(`/api/docs/content?path=${encodeURIComponent(path)}`),
  getGraph: () => getJson<GraphResponse>("/api/index/graph"),
  getManifest: () => getJson<ManifestResponse>("/api/index/manifest"),
  getWikiLedger: () => getJson<WikiLedgerResponse>("/api/wiki-ledger"),
  getSync: () => getJson<SyncState>("/api/sync"),
  getGitLog: (limit?: number) =>
    getJson<GitCommit[]>(`/api/git/log${limit ? `?limit=${limit}` : ""}`),
  getReleases: () => getJson<ReleasesResponse>("/api/releases"),
  getTraceCheck: () => getJson<TraceCheckResponse>("/api/trace-check"),
};
