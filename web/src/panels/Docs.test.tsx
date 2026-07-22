import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Docs from "./Docs";

const INVENTORY = {
  version: 1,
  docs: [
    {
      wiki_key: "plan/ia-content-model",
      canonical_key: "plan/2026-07-22-ia-content-model",
      aliases: ["plan/ia-content-model"],
      doc_type: "plan",
      title: "IA & content model",
      source: "docs/plans/2026-07-22-ia-content-model.md",
      truth_state: "current",
      supersedes: "plan/wiki-information-architecture",
      date: "2026-07-22",
    },
    {
      wiki_key: "plan/wiki-information-architecture",
      canonical_key: "plan/2026-07-22-wiki-information-architecture",
      doc_type: "plan",
      title: "Wiki information architecture",
      source: "docs/plans/2026-07-22-wiki-information-architecture.md",
      truth_state: "superseded",
      superseded_by: "plan/ia-content-model",
      date: "2026-07-22",
    },
    {
      wiki_key: "adr/0001-event-log",
      doc_type: "adr",
      title: "Event log ADR",
      source: "docs/adr/0001-event-log.md",
      truth_state: "current",
      date: "2026-07-19",
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/docs") {
        return new Response(JSON.stringify(INVENTORY), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.startsWith("/api/docs/content")) {
        return new Response("---\nwiki_key: x\n---\n# Hello\n\nBody text.", {
          status: 200,
          headers: { "Content-Type": "text/markdown" },
        });
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
});

describe("Docs panel", () => {
  it("filters the doc list by truth_state", async () => {
    render(
      <MemoryRouter initialEntries={["/docs"]}>
        <Docs />
      </MemoryRouter>,
    );

    expect(await screen.findByText("IA & content model")).toBeInTheDocument();
    expect(screen.getByText("Wiki information architecture")).toBeInTheDocument();
    expect(screen.getByText("Event log ADR")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("All truth states"), { target: { value: "superseded" } });

    expect(screen.getByText("Wiki information architecture")).toBeInTheDocument();
    expect(screen.queryByText("IA & content model")).not.toBeInTheDocument();
    expect(screen.queryByText("Event log ADR")).not.toBeInTheDocument();
  });

  it("renders an identity header with wiki_key and a navigable supersedes link when a doc is selected", async () => {
    render(
      <MemoryRouter initialEntries={["/docs?doc=" + encodeURIComponent("docs/plans/2026-07-22-ia-content-model.md")]}>
        <Docs />
      </MemoryRouter>,
    );

    const heading = await screen.findByRole("heading", { name: "IA & content model" });
    const header = heading.closest("div")!.parentElement!;
    expect(within(header).getByText("plan/2026-07-22-ia-content-model")).toBeInTheDocument(); // canonical_key
    expect(within(header).getAllByText("plan/ia-content-model").length).toBeGreaterThan(0); // wiki_key + aliases
    expect(within(header).getByRole("button", { name: "Wiki information architecture" })).toBeInTheDocument();

    expect(await screen.findByText("Body text.")).toBeInTheDocument();
  });
});
