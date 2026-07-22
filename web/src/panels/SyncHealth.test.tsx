import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SyncHealth from "./SyncHealth";

const ITEMS = [
  {
    id: "01LINKEDXXXXXXXXXXXXXXXXXX",
    title: "Linked open item",
    status: "in_progress",
    external: { system: "github", url: "https://github.com/org/repo/issues/5", number: 5 },
  },
  {
    id: "01UNPUSHEDXXXXXXXXXXXXXXXX",
    title: "Unpushed open item",
    status: "todo",
  },
  {
    id: "01DONEXXXXXXXXXXXXXXXXXXXX",
    title: "Closed item, ignored",
    status: "done",
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/sync") {
        return new Response(JSON.stringify({ items: {}, cursors: { github: "cursor-1" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "/api/items") {
        return new Response(JSON.stringify(ITEMS), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
});

describe("SyncHealth panel", () => {
  it("flags an unpushed open item and excludes the closed item", async () => {
    render(<SyncHealth />);

    expect(await screen.findByText("Unpushed open item")).toBeInTheDocument();
    expect(screen.queryByText("Closed item, ignored")).not.toBeInTheDocument();
    // The unpushed item's row is the only place its title appears; the linked
    // item only shows up collapsed inside the "already linked" <details>.
    expect(screen.queryByRole("cell", { name: "Unpushed open item" })).toBeInTheDocument();

    expect(screen.getByText("Open items").closest("div")).toHaveTextContent("2");
    expect(screen.getByText("Unpushed").closest("div")).toHaveTextContent("1");
    expect(screen.getByText("Linked to GitHub").closest("div")).toHaveTextContent("1");
  });

  it("shows the sync-never-run empty state on a 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/sync") {
          return new Response(JSON.stringify({ error: "sync-state.json not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url === "/api/items") {
          return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
        }
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }),
    );

    render(<SyncHealth />);

    expect(await screen.findByText(/sync never run/i)).toBeInTheDocument();
  });
});
