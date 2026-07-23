// Builds a throwaway worklog-shaped repo in a temp dir for tests. No network,
// no dependency on any real repo on disk.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function buildFixtureRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-fixture-"));

  fs.mkdirSync(path.join(dir, ".work"), { recursive: true });
  fs.mkdirSync(path.join(dir, "bin"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs", ".index"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs", "adr"), { recursive: true });
  fs.mkdirSync(path.join(dir, "docs", "guide"), { recursive: true });

  fs.writeFileSync(
    path.join(dir, ".work", "config.yml"),
    `# fixture config
version: 1

project:
  key: FIX
  name: "Fixture Project"

ticketing:
  system: github               # inline comment should be stripped
  project: acme/fixture-repo

wiki:
  system: github-wiki
  root_url: https://github.com/acme/fixture-repo/wiki

paths:
  plans: docs/plans
  status: docs/status
  roadmap: docs/roadmap.md
installed: 0.1.0
`,
  );

  // Two real-shaped events: one carries an explicit ts, the other doesn't
  // (so the server must derive it from the ev ULID) — timestamps chosen so
  // sort order is unambiguous.
  fs.writeFileSync(
    path.join(dir, ".work", "todo.jsonl"),
    [
      JSON.stringify({
        actor: "rick",
        ev: "01ARZ3NDEKTSV4RRFFQ69G5FAV", // ULID spec test vector: 2016-07-30T23:53:37.491Z
        item: "01ARZ3NDEKTSV4RRFFQ69G5FA1",
        op: "create",
        set: { title: "First item", status: "todo", priority: "P2", level: "task", kind: "feature" },
        ts: "2026-01-01T00:00:00Z",
      }),
      JSON.stringify({
        actor: "rick",
        ev: "01KXS7W15S2NQ0VJT9TDR7B7CX",
        item: "01KXS7W15SHYS5PSGGWHYMFKYM",
        op: "create",
        set: { title: "No explicit ts", status: "todo", priority: "P3", level: "task", kind: "triage" },
      }),
    ].join("\n") + "\n",
  );
  fs.writeFileSync(
    path.join(dir, ".work", "done.jsonl"),
    JSON.stringify({
      actor: "compactor",
      ev: "01KXWP67VP0WA674P5H2BHCR0J",
      item: "01ARZ3NDEKTSV4RRFFQ69G5FA1",
      op: "snapshot",
      set: { title: "First item", status: "done", priority: "P2", level: "task", kind: "feature" },
      ts: "2026-01-05T00:00:00Z",
    }) + "\n",
  );

  // Fake bin/worklog: only the subcommands the server shells out to.
  fs.writeFileSync(
    path.join(dir, "bin", "worklog"),
    `#!/usr/bin/env python3
import sys, json
cmd = sys.argv[1] if len(sys.argv) > 1 else ""
if cmd == "fold":
    print(json.dumps([
        {"id": "01ARZ3NDEKTSV4RRFFQ69G5FA1", "title": "First item", "status": "done", "priority": "P2", "level": "task", "kind": "feature"},
        {"id": "01KXS7W15SHYS5PSGGWHYMFKYM", "title": "No explicit ts", "status": "todo", "priority": "P3", "level": "task", "kind": "triage"},
    ]))
elif cmd == "trace-check":
    print("01KXS7W15SHYS5PSGGWHYMFKYM (open): no external ticket")
    sys.exit(1)
elif cmd == "--version":
    print("worklog 0.1.0")
`,
    { mode: 0o755 },
  );

  fs.writeFileSync(
    path.join(dir, "docs", ".index", "_inventory.json"),
    JSON.stringify(
      { docs: [{ wiki_key: "adr/0001-test", canonical_key: "adr/0001-test", doc_type: "adr", title: "Test ADR", truth_state: "current", source: "docs/adr/0001-test.md" }] },
      null,
      1,
    ),
  );
  fs.writeFileSync(
    path.join(dir, "docs", ".index", "_graph.json"),
    JSON.stringify({ edges: [{ from: "plan/x", to: "item/y", type: "produces" }] }, null, 1),
  );

  const adrContent = "# Test ADR\n\nFrozen content.\n";
  fs.writeFileSync(path.join(dir, "docs", "adr", "0001-test.md"), adrContent);
  fs.writeFileSync(path.join(dir, "docs", "guide", "pending.md"), "# Pending doc\n");

  fs.writeFileSync(
    path.join(dir, "docs", ".index", "publish-manifest.json"),
    JSON.stringify(
      {
        pages: [
          { wiki_key: "adr/0001-test", page_name: "ADR-0001-test", source: "docs/adr/0001-test.md", frozen: true, render_hash: "aaaaaaaaaaaa", title: "Test ADR", truth_state: "current" },
          { wiki_key: "roadmap", page_name: "Roadmap", source: "docs/roadmap.md", frozen: false, render_hash: "bbbbbbbbbbbb", title: "Roadmap", truth_state: "current" },
          { wiki_key: "guide/pending-doc", page_name: "Pending-Doc", source: "docs/guide/pending.md", frozen: true, render_hash: "cccccccccccc", title: "Pending Doc", truth_state: "current" },
        ],
      },
      null,
      1,
    ),
  );

  // Ledger entries exercising all three drift states:
  //  - adr/0001-test: frozen, source_hash matches actual file + render_hash matches manifest -> in-sync
  //  - roadmap: render_hash differs from manifest, source untouched -> pending
  //  - guide/pending-doc: frozen, source_hash does NOT match actual file -> source-drift
  fs.writeFileSync(
    path.join(dir, ".work", "published.json"),
    JSON.stringify(
      {
        "adr/0001-test": {
          wiki_key: "adr/0001-test",
          source: "docs/adr/0001-test.md",
          source_hash: "29df311d0357", // sha256("# Test ADR\n\nFrozen content.\n")[:12]
          render_hash: "aaaaaaaaaaaa",
          url: "https://github.com/acme/fixture-repo/wiki/ADR-0001-test",
          title: "Test ADR",
        },
        roadmap: {
          wiki_key: "roadmap",
          source: "docs/roadmap.md",
          source_hash: "deadbeef1234",
          render_hash: "zzzzzzzzzzzz",
          url: "https://github.com/acme/fixture-repo/wiki/Roadmap",
          title: "Roadmap",
        },
        "guide/pending-doc": {
          wiki_key: "guide/pending-doc",
          source: "docs/guide/pending.md",
          source_hash: "000000000000",
          render_hash: "cccccccccccc",
          url: "https://github.com/acme/fixture-repo/wiki/Pending-Doc",
          title: "Pending Doc",
        },
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    path.join(dir, "docs", "roadmap.md"),
    `---
wiki_key: roadmap
doc_type: roadmap
truth_state: current
source_hash: deadbeef1234
generated_at: 2026-01-01T00:00:00Z
---

# Roadmap

_Fixture roadmap body._
`,
  );

  return dir;
}
