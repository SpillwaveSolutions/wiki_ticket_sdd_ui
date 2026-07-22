import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Releases from "./Releases";

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("Releases panel", () => {
  it("renders the offline state when /api/releases reports offline:true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/releases") {
          return new Response(JSON.stringify({ offline: true, releases: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url === "/api/docs") {
          return new Response(JSON.stringify({ version: 1, docs: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );

    render(<Releases />);

    expect(await screen.findByText("Offline — no gh CLI or network")).toBeInTheDocument();
  });

  it("renders releases and links a matching roadmap snapshot as a chip", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/releases") {
          return new Response(
            JSON.stringify({
              offline: false,
              releases: [
                {
                  tag_name: "v0.12.1",
                  name: "v0.12.1",
                  published_at: "2026-07-21T15:01:12Z",
                  html_url: "https://github.com/org/repo/releases/tag/v0.12.1",
                  body: "Release notes",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url === "/api/docs") {
          return new Response(
            JSON.stringify({
              version: 1,
              docs: [
                {
                  wiki_key: "roadmap-snapshot/2026-07-21_v0.12.1-release",
                  doc_type: "roadmap-snapshot",
                  title: "Roadmap",
                  source: "docs/roadmap/2026-07-21_v0.12.1-release.md",
                  truth_state: "snapshot",
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );

    render(<Releases />);

    expect((await screen.findAllByText("v0.12.1")).length).toBeGreaterThan(0);
    const chip = await screen.findByRole("link", { name: "Roadmap" });
    expect(chip).toHaveAttribute(
      "href",
      "/docs?doc=" + encodeURIComponent("docs/roadmap/2026-07-21_v0.12.1-release.md"),
    );
  });
});
