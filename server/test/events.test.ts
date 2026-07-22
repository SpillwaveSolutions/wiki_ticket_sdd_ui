import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ulidTimestampIso } from "../src/ulid.js";
import { buildFixtureRepo } from "./fixture.js";

describe("ulidTimestampIso", () => {
  it("decodes the canonical ULID spec test vector", () => {
    // https://github.com/ulid/spec's example ULID; cross-checked against an
    // independent Crockford base32 decode (Python) to avoid testing the
    // implementation against itself.
    expect(ulidTimestampIso("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe("2016-07-30T23:54:10.259Z");
  });
});

describe("GET /api/events", () => {
  it("merges todo+done, derives ts from the ev ULID when missing, sorts desc", async () => {
    const dir = buildFixtureRepo();
    const app = createApp(dir);
    const res = await app.request("/api/events");
    expect(res.status).toBe(200);
    const events = await res.json();
    expect(events).toHaveLength(3);

    // The ts-less event's timestamp is derived from its ev ULID, which
    // decodes to 2026-07-17 — later than either explicit ts below — so it
    // sorts first (desc).
    const derived = events[0];
    expect(derived.ev).toBe("01KXS7W15S2NQ0VJT9TDR7B7CX");
    expect(derived.ts).toBe(ulidTimestampIso("01KXS7W15S2NQ0VJT9TDR7B7CX"));
    expect(derived.ts).not.toBeNull();

    // done.jsonl's 2026-01-05 event sorts next.
    expect(events[1].ev).toBe("01KXWP67VP0WA674P5H2BHCR0J");
    expect(events[1].ts).toBe("2026-01-05T00:00:00Z");

    // Explicit-ts event (2026-01-01) sorts last.
    expect(events[2].ev).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(events[2].ts).toBe("2026-01-01T00:00:00Z");
  });
});
