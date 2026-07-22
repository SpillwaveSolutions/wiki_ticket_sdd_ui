import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { PANELS } from "./lib/panels";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/repo") {
        return new Response(
          JSON.stringify({
            name: "wiki_ticket_sdd",
            key: "wts",
            repo_path: "/tmp/wiki_ticket_sdd",
            github_project: "SpillwaveSolutions/wiki_ticket_sdd",
            wiki_root_url: null,
            branch: "main",
            latest_tag: "v0.12.1",
            installed_version: "0.12.1",
            worklog_version: "0.12.1",
            drift: { dirty: false, version_skew: false },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url === "/api/items") {
        return new Response(JSON.stringify([{ id: "1", title: "x", status: "todo" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }),
  );
});

describe("App shell", () => {
  it("renders the nav with a link for every panel", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    for (const panel of PANELS) {
      expect(screen.getByRole("link", { name: panel.label })).toBeInTheDocument();
    }
  });

  it("renders the top bar", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("WikiTicket UI")).toBeInTheDocument();
  });

  it("routes / to the Overview panel", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
  });
});
