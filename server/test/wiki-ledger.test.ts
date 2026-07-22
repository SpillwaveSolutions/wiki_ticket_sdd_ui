import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { buildFixtureRepo } from "./fixture.js";

describe("GET /api/wiki-ledger", () => {
  it("classifies all three drift states", async () => {
    const dir = buildFixtureRepo();
    const app = createApp(dir);
    const res = await app.request("/api/wiki-ledger");
    expect(res.status).toBe(200);
    const ledger = await res.json();

    // Frozen page, source_hash matches the actual file, render_hash matches
    // the manifest -> in-sync.
    expect(ledger["adr/0001-test"].drift).toBe("in-sync");

    // Not frozen, render_hash differs from the manifest (a banner/render
    // change with the source untouched) -> pending.
    expect(ledger["roadmap"].drift).toBe("pending");

    // Frozen page whose source_hash no longer matches the actual file on
    // disk -> a frozen-source integrity violation.
    expect(ledger["guide/pending-doc"].drift).toBe("source-drift");

    // Original ledger fields survive alongside the computed drift.
    expect(ledger["adr/0001-test"].url).toBe("https://github.com/acme/fixture-repo/wiki/ADR-0001-test");
  });
});
