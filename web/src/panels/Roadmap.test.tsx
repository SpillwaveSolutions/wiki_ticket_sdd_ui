import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Roadmap from "./Roadmap";

// jsdom can't run mermaid's layout engine — mock it so MermaidBlock resolves
// synchronously-ish with a stub SVG instead of hitting real rendering.
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (id: string) => ({ svg: `<svg data-id="${id}">mock</svg>` })),
  },
}));

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const markdown = `---
wiki_key: roadmap
doc_type: roadmap
truth_state: current
source_hash: abc123
generated_at: 2026-07-22T22:46:14Z
---

# Roadmap

## Now

Doing stuff.

## Next

\`\`\`mermaid
graph LR
  a --> b
\`\`\`

## Later
`;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/roadmap") {
        return jsonResponse({
          meta: { wiki_key: "roadmap", source_hash: "abc123", generated_at: "2026-07-22T22:46:14Z" },
          markdown,
        });
      }
      return jsonResponse({});
    }),
  );
});

describe("Roadmap", () => {
  it("strips the YAML frontmatter and renders the meta as chips", async () => {
    render(<Roadmap />);

    expect(await screen.findByText("generated 2026-07-22T22:46:14Z")).toBeInTheDocument();
    expect(screen.getByText("hash abc123")).toBeInTheDocument();
    // frontmatter body content must not leak into the rendered markdown
    expect(screen.queryByText(/wiki_key: roadmap/)).not.toBeInTheDocument();
  });

  it("renders Now/Next/Later headings and a table of contents", async () => {
    render(<Roadmap />);

    expect(await screen.findByRole("heading", { name: "Now" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Later" })).toBeInTheDocument();
    expect(screen.getByText("On this page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Now" })).toHaveAttribute("href", "#now");
  });

  it("renders mermaid fences via the mocked mermaid.render", async () => {
    render(<Roadmap />);
    expect(await screen.findByText("mock")).toBeInTheDocument();
  });
});
