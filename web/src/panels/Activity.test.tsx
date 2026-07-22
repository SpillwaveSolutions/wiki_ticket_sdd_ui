import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Activity from "./Activity";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const events = [
  { ev: "e1", item: "1", op: "create", ts: "2026-07-20T10:00:00Z", actor: "rick", set: { title: "New item" } },
  { ev: "e2", item: "1", op: "close", ts: "2026-07-22T09:00:00Z", actor: "rick" },
];

const commits = [{ hash: "abc123", author: "rick", date: "2026-07-21T12:00:00Z", subject: "fix: something" }];

const releases = {
  offline: false,
  releases: [{ tag_name: "v0.12.1", name: "v0.12.1", published_at: "2026-07-19T08:00:00Z", html_url: "https://x" }],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/events") return jsonResponse(events);
      if (url.startsWith("/api/git/log")) return jsonResponse(commits);
      if (url === "/api/releases") return jsonResponse(releases);
      return jsonResponse({});
    }),
  );
});

describe("Activity", () => {
  it("merges the three sources and sorts them newest-first", async () => {
    render(<Activity />);

    const rows = await screen.findAllByRole("listitem");
    // newest -> oldest: close (07-22), git commit (07-21), create (07-20), release (07-19)
    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent("close");
    expect(rows[1]).toHaveTextContent("fix: something");
    expect(rows[2]).toHaveTextContent("create — New item");
    expect(rows[3]).toHaveTextContent("Released v0.12.1");
  });

  it("reports the shown/total count", async () => {
    render(<Activity />);
    expect(await screen.findByText("Showing 4 of 4")).toBeInTheDocument();
  });

  it("filters by source", async () => {
    render(<Activity />);
    await screen.findAllByRole("listitem");
    const gitCheckbox = screen.getByLabelText("git");
    fireEvent.click(gitCheckbox);

    expect(screen.queryByText("fix: something")).not.toBeInTheDocument();
    expect(await screen.findByText(/Showing 3 of 3/)).toBeInTheDocument();
  });
});
