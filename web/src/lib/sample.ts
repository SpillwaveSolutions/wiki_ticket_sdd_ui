import type { GitCommit, ReleasesResponse, RepoInfo, RoadmapResponse, WorklogEvent, WorklogItem } from "./types";

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
  },
  {
    id: "01SAMPLESTORY000000000001",
    title: "Overview panel with milestone bars",
    status: "done",
    level: "story",
    kind: "feature",
    parent: "01SAMPLEEPIC0000000000001",
    milestone: "v0.2",
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
