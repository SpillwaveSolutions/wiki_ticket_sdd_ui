import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { api, ApiError, isTauri } from "./api";

function mockFetchOnce(body: unknown, status = 200) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function clearTauriGlobals() {
  clearMocks();
  const w = window as unknown as Record<string, unknown>;
  delete w.__TAURI_INTERNALS__;
  delete w.__TAURI__;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  clearTauriGlobals();
});

afterEach(() => {
  clearTauriGlobals();
});

describe("api.ts URL building (web / fetch)", () => {
  it("getRepo hits /api/repo", async () => {
    const fetchMock = mockFetchOnce({});
    await api.getRepo();
    expect(fetchMock).toHaveBeenCalledWith("/api/repo");
  });

  it("getItems hits /api/items", async () => {
    const fetchMock = mockFetchOnce([]);
    await api.getItems();
    expect(fetchMock).toHaveBeenCalledWith("/api/items");
  });

  it("getGitLog omits the query string when no limit is given", async () => {
    const fetchMock = mockFetchOnce([]);
    await api.getGitLog();
    expect(fetchMock).toHaveBeenCalledWith("/api/git/log");
  });

  it("getGitLog appends ?limit= when given", async () => {
    const fetchMock = mockFetchOnce([]);
    await api.getGitLog(50);
    expect(fetchMock).toHaveBeenCalledWith("/api/git/log?limit=50");
  });

  it("getDocContent URL-encodes the path query param", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("markdown", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await api.getDocContent("docs/adr/0001 test.md");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/docs/content?path=docs%2Fadr%2F0001%20test.md",
    );
  });

  it("throws ApiError with the server's error message on non-2xx", async () => {
    mockFetchOnce({ error: "not found: x" }, 404);
    await expect(api.getRoadmap()).rejects.toThrow("not found: x");
  });

  it("isTauri is false without Tauri globals", () => {
    expect(isTauri()).toBe(false);
  });

  it("pickRepo rejects outside the desktop app", async () => {
    await expect(api.pickRepo()).rejects.toMatchObject({
      message: expect.stringMatching(/desktop/i),
      status: 400,
    });
  });

  it("setRepo rejects outside the desktop app", async () => {
    await expect(api.setRepo("/tmp/x")).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe("api.ts Tauri invoke path", () => {
  it("detects Tauri via __TAURI_INTERNALS__", () => {
    mockIPC(() => ({}));
    expect(isTauri()).toBe(true);
  });

  it("getRepo invokes get_repo and returns the payload", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_repo") {
        return { key: "FIX", name: "Fixture", path: "/tmp/fix" };
      }
      throw new Error(`unexpected command: ${cmd}`);
    });
    await expect(api.getRepo()).resolves.toMatchObject({ key: "FIX" });
  });

  it("getItems invokes get_items", async () => {
    mockIPC((cmd) => {
      if (cmd === "get_items") return [{ id: "1", title: "a", status: "todo" }];
      throw new Error(`unexpected: ${cmd}`);
    });
    const items = await api.getItems();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("a");
  });

  it("getGitLog forwards limit as invoke args", async () => {
    let seen: unknown;
    mockIPC((cmd, args) => {
      if (cmd === "get_git_log") {
        seen = args;
        return [];
      }
      throw new Error(`unexpected: ${cmd}`);
    });
    await api.getGitLog(25);
    expect(seen).toEqual({ limit: 25 });
  });

  it("getDocContent invokes get_doc_content with path", async () => {
    let seen: unknown;
    mockIPC((cmd, args) => {
      if (cmd === "get_doc_content") {
        seen = args;
        return "# hi";
      }
      throw new Error(`unexpected: ${cmd}`);
    });
    await expect(api.getDocContent("docs/a.md")).resolves.toBe("# hi");
    expect(seen).toEqual({ path: "docs/a.md" });
  });

  it("maps structured invoke errors to ApiError(status)", async () => {
    mockIPC(() => {
      throw { status: 404, message: "not found: roadmap" };
    });
    try {
      await api.getRoadmap();
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(404);
      expect((e as ApiError).message).toBe("not found: roadmap");
    }
  });

  it("pickRepo / setRepo call the desktop commands", async () => {
    const calls: string[] = [];
    mockIPC((cmd, args) => {
      calls.push(cmd);
      if (cmd === "pick_repo") return { key: "A", path: "/a" };
      if (cmd === "set_repo") return { key: "B", path: (args as { path: string }).path };
      throw new Error(`unexpected: ${cmd}`);
    });
    await expect(api.pickRepo()).resolves.toMatchObject({ path: "/a" });
    await expect(api.setRepo("/b")).resolves.toMatchObject({ path: "/b" });
    expect(calls).toEqual(["pick_repo", "set_repo"]);
  });

  it("does not call fetch when in Tauri mode", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockIPC((cmd) => {
      if (cmd === "get_events") return [];
      throw new Error(`unexpected: ${cmd}`);
    });
    await api.getEvents();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("api.ts sample mode", () => {
  beforeEach(() => {
    sessionStorage.setItem("wiki-ticket-sample", "1");
  });
  afterEach(() => {
    sessionStorage.removeItem("wiki-ticket-sample");
  });

  it("returns fixture repo/items/events/roadmap/git/releases without fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const repo = await api.getRepo();
    const items = await api.getItems();
    const events = await api.getEvents();
    const roadmap = await api.getRoadmap();
    const commits = await api.getGitLog(2);
    const releases = await api.getReleases();
    expect(repo.name).toBe("sample-worklog");
    expect(items.length).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThan(0);
    expect(roadmap.markdown).toMatch(/mermaid/);
    expect(commits).toHaveLength(2);
    expect(releases.releases[0]?.tag_name).toBe("v0.1.0");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns fixture docs inventory, content, graph, and trace-check without fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const docs = await api.getDocs();
    const content = await api.getDocContent("docs/adr/0001-empty-state.md");
    const graph = await api.getGraph();
    const trace = await api.getTraceCheck();
    expect(docs.docs.length).toBeGreaterThan(0);
    expect(docs.docs.some((d) => d.truth_state === "superseded")).toBe(true);
    expect(content).toMatch(/guided empty state/i);
    expect(Object.keys(graph.nodes).length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(trace.ok).toBe(true);
    expect(trace.output).toMatch(/no unlinked evidence/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns fixture wiki ledger and sync state without fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const ledger = await api.getWikiLedger();
    const sync = await api.getSync();
    const drifts = Object.values(ledger).map((e) => e.drift);
    expect(drifts).toEqual(expect.arrayContaining(["in-sync", "pending", "source-drift"]));
    expect(sync.cursors?.github).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
