import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PublishPlane from "./PublishPlane";

const LEDGER = {
  "adr/0001": {
    rev: "abc",
    source: "docs/adr/0001.md",
    source_hash: "aaa",
    render_hash: "bbb",
    url: "https://example.com/wiki/ADR-0001",
    title: "ADR 0001",
    wiki_key: "adr/0001",
    truth_state: "current",
    drift: "in-sync",
  },
  "guide/cli": {
    rev: "def",
    source: "docs/user_guide/cli.md",
    source_hash: "ccc",
    render_hash: "ddd",
    url: "https://example.com/wiki/CLI",
    title: "CLI guide",
    wiki_key: "guide/cli",
    truth_state: "current",
    drift: "pending",
  },
  "plan/frozen": {
    rev: "ghi",
    source: "docs/plans/frozen.md",
    source_hash: "eee",
    render_hash: "fff",
    url: "https://example.com/wiki/Plan-frozen",
    title: "Frozen plan",
    wiki_key: "plan/frozen",
    truth_state: "current",
    drift: "source-drift",
  },
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/wiki-ledger") {
        return new Response(JSON.stringify(LEDGER), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
});

describe("PublishPlane panel", () => {
  it("classifies all three drift states from the fixture ledger", async () => {
    render(<PublishPlane />);

    expect(await screen.findByText("in-sync")).toBeInTheDocument();
    expect(screen.getByText("pending republish")).toBeInTheDocument();
    expect(screen.getByText("SOURCE DRIFT")).toBeInTheDocument();

    // Summary header counts one of each state.
    const inSyncCard = screen.getByText("In sync").closest("div")!;
    expect(within(inSyncCard).getByText("1")).toBeInTheDocument();
  });

  it("gives the source-drift row emphasis and an explanatory tooltip", async () => {
    render(<PublishPlane />);

    const driftLabel = await screen.findByText("SOURCE DRIFT");
    const row = driftLabel.closest("tr")!;
    expect(row.className).toContain("bg-red-950");
    const dot = row.querySelector("span[title]");
    expect(dot?.getAttribute("title")).toMatch(/frozen source/i);
  });
});
