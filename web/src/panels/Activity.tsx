import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { relativeTime } from "../lib/format";
import type { GitCommit, Release, WorklogEvent } from "../lib/types";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { EmptyState, ErrorState } from "../components/EmptyState";

// Panel 4 — see docs/plans/2026-07-22-wiki-ticket-ui-ia.md panel 4 (Activity).

const CAP = 200;

type Source = "worklog" | "git" | "release";

interface FeedRow {
  id: string;
  source: Source;
  op?: string;
  ts: string;
  actor?: string;
  summary: string;
  href?: string;
}

function worklogSummary(ev: WorklogEvent): string {
  const title = typeof ev.set?.title === "string" ? ev.set.title : undefined;
  return title ? `${ev.op} — ${title}` : `${ev.op} ${ev.item}`;
}

function toRows(events: WorklogEvent[], commits: GitCommit[], releases: Release[]): FeedRow[] {
  const worklogRows: FeedRow[] = events
    .filter((ev) => ev.ts)
    .map((ev) => ({
      id: ev.ev,
      source: "worklog",
      op: ev.op,
      ts: ev.ts as string,
      actor: ev.actor,
      summary: worklogSummary(ev),
    }));

  const gitRows: FeedRow[] = commits.map((c) => ({
    id: c.hash,
    source: "git",
    ts: c.date,
    actor: c.author,
    summary: c.subject,
  }));

  const releaseRows: FeedRow[] = releases
    .filter((r) => r.published_at)
    .map((r) => ({
      id: r.tag_name,
      source: "release",
      ts: r.published_at as string,
      summary: `Released ${r.name || r.tag_name}`,
      href: r.html_url,
    }));

  return [...worklogRows, ...gitRows, ...releaseRows].sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0));
}

const SOURCE_STYLE: Record<Source, string> = {
  worklog: "border-accent/40 bg-accent/10 text-accent",
  git: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  release: "border-violet-500/30 bg-violet-500/10 text-violet-300",
};

const SOURCE_LABEL: Record<Source, string> = { worklog: "worklog", git: "git", release: "release" };

function SourceBadge({ source }: { source: Source }) {
  return (
    <span className={`inline-flex w-16 shrink-0 justify-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${SOURCE_STYLE[source]}`}>
      {SOURCE_LABEL[source]}
    </span>
  );
}

function ActivityBody({ events, commits, releases }: { events: WorklogEvent[]; commits: GitCommit[]; releases: Release[] }) {
  const [sources, setSources] = useState<Set<Source>>(new Set(["worklog", "git", "release"]));
  const [op, setOp] = useState<string>("all");

  const rows = useMemo(() => toRows(events, commits, releases), [events, commits, releases]);
  const ops = useMemo(
    () => [...new Set(events.map((e) => e.op).filter(Boolean))].sort(),
    [events],
  );

  const filtered = rows.filter((r) => sources.has(r.source) && (r.source !== "worklog" || op === "all" || r.op === op));
  const shown = filtered.slice(0, CAP);

  function toggleSource(s: Source) {
    setSources((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  return (
    <Panel
      title="Activity"
      toolbar={
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          {(["worklog", "git", "release"] as Source[]).map((s) => (
            <label key={s} className="flex items-center gap-1.5">
              <input type="checkbox" checked={sources.has(s)} onChange={() => toggleSource(s)} />
              {SOURCE_LABEL[s]}
            </label>
          ))}
          <select
            value={op}
            onChange={(e) => setOp(e.target.value)}
            className="focus-ring rounded border border-slate-800 bg-slate-900 px-2 py-1 text-slate-300 focus:border-accent/50"
          >
            <option value="all">all ops</option>
            {ops.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <p className="mb-3 text-xs text-slate-500">
        Showing {shown.length} of {filtered.length}
        {filtered.length !== rows.length ? ` (${rows.length} total)` : ""}
      </p>
      {shown.length === 0 ? (
        <EmptyState title="No activity" detail="Nothing matches the current filters." />
      ) : (
        <ul className="space-y-1.5">
          {shown.map((row) => (
            <li key={`${row.source}-${row.id}`} className="flex items-center gap-3 rounded-lg border border-slate-800/70 px-3 py-2 text-sm">
              <SourceBadge source={row.source} />
              <span className="min-w-0 flex-1 truncate text-slate-200">
                {row.href ? (
                  <a href={row.href} target="_blank" rel="noreferrer" className="hover:underline">
                    {row.summary}
                  </a>
                ) : (
                  row.summary
                )}
              </span>
              {row.actor && <span className="shrink-0 text-xs text-slate-500">{row.actor}</span>}
              <span className="shrink-0 text-xs text-slate-500">{relativeTime(row.ts)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function Activity() {
  const events = useApi(() => api.getEvents(), []);
  const commits = useApi(() => api.getGitLog(100), []);
  const releases = useApi(() => api.getReleases(), []);

  if (events.status === "loading" || commits.status === "loading" || releases.status === "loading") {
    return (
      <Panel title="Activity">
        <Spinner label="Loading activity…" />
      </Panel>
    );
  }
  if (events.status === "error") {
    return (
      <Panel title="Activity">
        <ErrorState message={events.error} />
      </Panel>
    );
  }

  return (
    <ActivityBody
      events={events.data}
      commits={commits.status === "ok" ? commits.data : []}
      releases={releases.status === "ok" ? releases.data.releases : []}
    />
  );
}
