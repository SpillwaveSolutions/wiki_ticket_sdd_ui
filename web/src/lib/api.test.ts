import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

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

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("api.ts URL building", () => {
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
    const fetchMock = mockFetchOnce("markdown");
    await api.getDocContent("docs/adr/0001 test.md");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/docs/content?path=docs%2Fadr%2F0001%20test.md",
    );
  });

  it("throws ApiError with the server's error message on non-2xx", async () => {
    mockFetchOnce({ error: "not found: x" }, 404);
    await expect(api.getRoadmap()).rejects.toThrow("not found: x");
  });
});
