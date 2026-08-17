import type {
  GitCommit,
  GraphResponse,
  InventoryResponse,
  ReleasesResponse,
  RepoInfo,
  RoadmapResponse,
  SyncState,
  TraceCheckResponse,
  WikiLedgerResponse,
  WorklogEvent,
  WorklogItem,
} from "./types";

export const SAMPLE_FLAG = "wiki-ticket-sample";

export function isSampleMode(): boolean {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(SAMPLE_FLAG) === "1";
  } catch {
    return false;
  }
}

export function enableSampleMode(): void {
  sessionStorage.setItem(SAMPLE_FLAG, "1");
}

export function disableSampleMode(): void {
  sessionStorage.removeItem(SAMPLE_FLAG);
}

/** Offline demo corpus so panels render without a real WikiTicket SDD folder. */
export const SAMPLE_REPO: RepoInfo = {
  name: "sample-worklog",
  key: "sample",
  repo_path: "(sample)",
  github_project: null,
  wiki_root_url: null,
  branch: "main",
  latest_tag: "v0.1.0",
  installed_version: "0.16.1",
  worklog_version: "0.16.1",
  drift: { dirty: false, version_skew: false },
};

export const SAMPLE_ITEMS: WorklogItem[] = [
  {
    id: "01SAMPLEEPIC0000000000001",
    title: "Ship WikiTicket UI read-only dashboard",
    status: "in_progress",
    level: "epic",
    kind: "feature",
    priority: "P1",
    milestone: "v0.2",
    labels: ["ui", "sample"],
    external: {
      system: "github",
      key: 1,
      url: "https://github.com/SpillwaveSolutions/wiki_ticket_sdd_ui/issues/1",
    },
  },
  {
    id: "01SAMPLESTORY000000000001",
    title: "Overview panel with milestone bars",
    status: "done",
    level: "story",
    kind: "feature",
    parent: "01SAMPLEEPIC0000000000001",
    milestone: "v0.2",
    external: {
      system: "github",
      key: 2,
      url: "https://github.com/SpillwaveSolutions/wiki_ticket_sdd_ui/issues/2",
    },
  },
  {
    id: "01SAMPLESTORY000000000002",
    title: "Board with item drawer",
    status: "in_progress",
    level: "story",
    kind: "feature",
    parent: "01SAMPLEEPIC0000000000001",
    milestone: "v0.2",
  },
  {
    id: "01SAMPLETASK0000000000001",
    title: "Add sample worklog empty-state CTA",
    status: "todo",
    level: "task",
    kind: "feature",
    parent: "01SAMPLESTORY000000000002",
    milestone: "v0.2",
  },
  {
    id: "01SAMPLEBUG0000000000001",
    title: "Mobile nav overflow on 390px",
    status: "blocked",
    level: "task",
    kind: "bug",
    priority: "P2",
    milestone: "v0.2",
    labels: ["mobile"],
  },
  {
    id: "01SAMPLEDONE0000000000001",
    title: "Install UI Guard wireframes",
    status: "done",
    level: "task",
    kind: "ops",
    milestone: "v0.1",
  },
  {
    id: "01SAMPLEORPHAN00000000001",
    title: "Orphan event from a deleted item",
    status: "todo",
    level: "task",
    kind: "ops",
    _orphan: true,
  },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

export const SAMPLE_EVENTS: WorklogEvent[] = [
  {
    ev: "01SAMPLEEV00000000000001",
    item: "01SAMPLEEPIC0000000000001",
    op: "create",
    set: { title: "Ship WikiTicket UI read-only dashboard", status: "todo" },
    ts: daysAgo(12),
    actor: "sample",
  },
  {
    ev: "01SAMPLEEV00000000000002",
    item: "01SAMPLESTORY000000000001",
    op: "create",
    set: { title: "Overview panel with milestone bars", status: "todo" },
    ts: daysAgo(10),
    actor: "sample",
  },
  {
    ev: "01SAMPLEEV00000000000003",
    item: "01SAMPLESTORY000000000001",
    op: "close",
    set: { status: "done" },
    ts: daysAgo(4),
    actor: "sample",
  },
  {
    ev: "01SAMPLEEV00000000000004",
    item: "01SAMPLESTORY000000000002",
    op: "create",
    set: { title: "Board with item drawer", status: "in_progress" },
    ts: daysAgo(3),
    actor: "sample",
  },
  {
    ev: "01SAMPLEEV00000000000005",
    item: "01SAMPLEBUG0000000000001",
    op: "create",
    set: { title: "Mobile nav overflow on 390px", status: "blocked" },
    ts: daysAgo(1),
    actor: "sample",
  },
];

export const SAMPLE_ROADMAP: RoadmapResponse = {
  meta: {
    wiki_key: "roadmap",
    doc_type: "roadmap",
    truth_state: "canonical",
  },
  markdown: `---
wiki_key: roadmap
doc_type: roadmap
truth_state: canonical
---

# Roadmap

## Now

| Item | Status |
| --- | --- |
| Overview panel | done |
| Board drawer | in progress |
| Sample worklog | in progress |

## Next

- Roadmap mermaid walkthrough
- Activity feed with git + releases
- Traceability graph

\`\`\`mermaid
flowchart LR
  Overview --> Board
  Board --> Roadmap
  Roadmap --> Activity
\`\`\`
`,
};

export const SAMPLE_COMMITS: GitCommit[] = [
  {
    hash: "a1b2c3d",
    author: "sample",
    date: daysAgo(2),
    subject: "feat: sample worklog empty state",
  },
  {
    hash: "e4f5a6b",
    author: "sample",
    date: daysAgo(6),
    subject: "feat: mobile menu drawer",
  },
  {
    hash: "c7d8e9f",
    author: "sample",
    date: daysAgo(11),
    subject: "docs: as-built wireframes",
  },
];

export const SAMPLE_RELEASES: ReleasesResponse = {
  offline: false,
  releases: [
    {
      tag_name: "v0.1.0",
      name: "v0.1.0 — UI Guard",
      published_at: daysAgo(8),
      html_url: "https://github.com/SpillwaveSolutions/wiki_ticket_sdd_ui/releases/tag/v0.1.0",
    },
  ],
};

export const SAMPLE_DOCS: InventoryResponse = {
  version: 1,
  docs: [
    {
      wiki_key: "ui-guard-plan",
      doc_type: "plan",
      title: "UI Guard wireframe-first plan",
      source: "docs/plans/ui-guard.md",
      status: "active",
      truth_state: "current",
      tags: ["ui", "process"],
      date: "2026-08-16",
    },
    {
      wiki_key: "empty-state-adr",
      canonical_key: "empty-state-adr",
      doc_type: "adr",
      title: "ADR: guided empty state over raw 400s",
      source: "docs/adr/0001-empty-state.md",
      status: "accepted",
      truth_state: "current",
      supersedes: "empty-state-adr-draft",
      tags: ["ux"],
      date: "2026-08-16",
    },
    {
      wiki_key: "empty-state-adr-draft",
      doc_type: "adr",
      title: "Draft: empty-state copy (superseded)",
      source: "docs/adr/0001-empty-state-draft.md",
      status: "superseded",
      truth_state: "superseded",
      superseded_by: "empty-state-adr",
      date: "2026-08-15",
    },
    {
      wiki_key: "roadmap",
      doc_type: "roadmap",
      title: "Product Roadmap",
      source: "docs/roadmap.md",
      truth_state: "current",
    },
    {
      wiki_key: "status-2026-08",
      doc_type: "status",
      title: "August status",
      source: "docs/status/2026-08.md",
      truth_state: "current",
      date: "2026-08-16",
    },
  ],
};

export const SAMPLE_DOC_CONTENT: Record<string, string> = {
  "docs/plans/ui-guard.md": `# UI Guard wireframe-first plan

Wireframes under \`wireframes/\` are the contract. Hooks and CI block UI
edits that skip the wireframe update.

## Next

- Image block in ForgeNotes
- Tree-aware New Note in Motion
- Sample Docs + Traceability here
`,
  "docs/adr/0001-empty-state.md": `# ADR: guided empty state over raw 400s

When no worklog repo is selected, show a guided empty state with
**Choose repo** and **Load sample worklog**.
`,
  "docs/adr/0001-empty-state-draft.md": `# Draft: empty-state copy (superseded)

Replaced by the guided empty state ADR.
`,
  "docs/roadmap.md": SAMPLE_ROADMAP.markdown,
  "docs/status/2026-08.md": `# August status

Sample worklog, Roadmap, Activity, and Releases fixtures are live.
Docs and Traceability fixtures ship next.
`,
};

export const SAMPLE_GRAPH: GraphResponse = {
  version: 1,
  nodes: {
    "ui-guard-plan": {
      doc_type: "plan",
      source: "docs/plans/ui-guard.md",
      title: "UI Guard wireframe-first plan",
      truth_state: "current",
    },
    "01SAMPLEEPIC0000000000001": {
      doc_type: "item",
      title: "Ship WikiTicket UI read-only dashboard",
      status: "in_progress",
    },
    "01SAMPLESTORY000000000001": {
      doc_type: "item",
      title: "Overview panel with milestone bars",
      status: "done",
    },
    "ticket:SAMPLE-1": {
      doc_type: "ticket",
      title: "SAMPLE-1 Guided empty state",
      url: "https://github.com/SpillwaveSolutions/wiki_ticket_sdd_ui/issues/1",
    },
    "pr:32": {
      doc_type: "pr",
      title: "PR #32 Bookmark block",
      url: "https://github.com/SpillwaveSolutions/forge-notes/pull/32",
    },
    "release:v0.1.0": {
      doc_type: "release",
      title: "v0.1.0 — UI Guard",
    },
    roadmap: {
      doc_type: "roadmap",
      title: "Product Roadmap",
      source: "docs/roadmap.md",
      truth_state: "current",
    },
  },
  edges: [
    { from: "ui-guard-plan", to: "01SAMPLEEPIC0000000000001", type: "produces" },
    { from: "01SAMPLEEPIC0000000000001", to: "01SAMPLESTORY000000000001", type: "belongs-to" },
    { from: "01SAMPLEEPIC0000000000001", to: "ticket:SAMPLE-1", type: "targets" },
    { from: "01SAMPLESTORY000000000001", to: "pr:32", type: "lands-in" },
    { from: "pr:32", to: "release:v0.1.0", type: "lands-in" },
    { from: "ui-guard-plan", to: "roadmap", type: "references" },
  ],
};

export const SAMPLE_TRACE_CHECK: TraceCheckResponse = {
  ok: true,
  output: "trace: no unlinked evidence\n",
  gaps: 0,
};

export const SAMPLE_LEDGER: WikiLedgerResponse = {
  "ui-guard-plan": {
    rev: "1",
    source: "docs/plans/ui-guard.md",
    source_hash: "aaa111",
    render_hash: "aaa111",
    url: "https://example.test/wiki/ui-guard-plan",
    title: "UI Guard wireframe-first plan",
    wiki_key: "ui-guard-plan",
    doc_type: "plan",
    truth_state: "current",
    drift: "in-sync",
  },
  "empty-state-adr": {
    rev: "2",
    source: "docs/adr/0001-empty-state.md",
    source_hash: "bbb222",
    render_hash: "bbb333",
    url: "https://example.test/wiki/empty-state-adr",
    title: "ADR: guided empty state over raw 400s",
    wiki_key: "empty-state-adr",
    doc_type: "adr",
    truth_state: "current",
    drift: "pending",
  },
  roadmap: {
    rev: "1",
    source: "docs/roadmap.md",
    source_hash: "ccc444",
    render_hash: "ccc555",
    url: "https://example.test/wiki/roadmap",
    title: "Product Roadmap",
    wiki_key: "roadmap",
    doc_type: "roadmap",
    truth_state: "current",
    drift: "source-drift",
  },
};

export const SAMPLE_SYNC: SyncState = {
  adapter_path: ".work/adapters/github.json",
  cursors: {
    github: "2026-08-16T18:00:00.000Z",
    wiki: "2026-08-16T12:00:00.000Z",
  },
  items: {
    "01SAMPLEEPIC0000000000001": {
      last_push: "2026-08-16T18:00:00.000Z",
      last_pushed_hash: "deadbeef",
    },
    "01SAMPLESTORY000000000001": {
      last_push: "2026-08-12T10:00:00.000Z",
      last_pushed_hash: "cafebabe",
    },
  },
};


