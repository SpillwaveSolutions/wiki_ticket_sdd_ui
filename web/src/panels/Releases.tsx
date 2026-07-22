import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { relativeTime } from "../lib/format";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { ErrorState, OfflineState, EmptyState } from "../components/EmptyState";
import type { InventoryDoc } from "../lib/types";

// Wave 2: GitHub releases timeline linked to frozen roadmap snapshots via
// truth_state == "snapshot" — see plan panel 5 (changed panel).

/** Snapshot docs whose wiki_key or date matches a release tag, e.g. a doc
 * with wiki_key "roadmap/v0.12.0" or date "2026-07-19" matching tag "v0.12.0". */
function snapshotsForTag(docs: InventoryDoc[], tag: string): InventoryDoc[] {
  const bareTag = tag.replace(/^v/, "");
  return docs.filter((d) => {
    if (d.truth_state !== "snapshot") return false;
    const key = d.wiki_key ?? "";
    return key.includes(tag) || key.includes(bareTag);
  });
}

function ReleaseRow({ tag, name, date, url, body, snapshots }: {
  tag: string;
  name?: string;
  date?: string;
  url?: string;
  body?: string;
  snapshots: InventoryDoc[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="glass rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
            {tag}
          </span>
          <span className="text-sm font-medium text-slate-200">{name || tag}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {date && <span title={new Date(date).toLocaleString()}>{relativeTime(date)}</span>}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="focus-ring rounded text-accent hover:underline"
            >
              GitHub release
            </a>
          )}
        </div>
      </div>

      {snapshots.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {snapshots.map((s) => (
            <a
              key={s.wiki_key}
              href={`/docs?doc=${encodeURIComponent(s.source)}`}
              className="focus-ring rounded-full border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[11px] text-blue-300 transition-colors hover:bg-blue-500/25"
            >
              {s.title}
            </a>
          ))}
        </div>
      )}

      {body && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="focus-ring rounded text-xs text-slate-400 transition-colors hover:text-slate-200"
          >
            {open ? "Hide notes" : "Show notes"}
          </button>
          {open && (
            <div className="prose prose-invert prose-sm mt-2 max-w-none text-slate-300">
              <ReactMarkdown>{body}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function Releases() {
  const releases = useApi(() => api.getReleases(), []);
  const docs = useApi(() => api.getDocs(), []);

  const docList = docs.status === "ok" ? docs.data.docs : [];

  const rows = useMemo(() => {
    if (releases.status !== "ok" || releases.data.offline) return [];
    return releases.data.releases.map((r) => ({
      tag: r.tag_name,
      name: r.name,
      date: r.published_at,
      url: r.html_url,
      body: r.body,
      snapshots: snapshotsForTag(docList, r.tag_name),
    }));
  }, [releases, docList]);

  return (
    <Panel title="Releases">
      {releases.status === "loading" && <Spinner label="Loading /api/releases…" />}
      {releases.status === "error" && <ErrorState message={releases.error} />}
      {releases.status === "ok" && releases.data.offline && <OfflineState />}
      {releases.status === "ok" && !releases.data.offline && rows.length === 0 && (
        <EmptyState title="No releases yet" detail="This repo has no GitHub releases." />
      )}
      {releases.status === "ok" && !releases.data.offline && rows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <ReleaseRow key={r.tag} {...r} />
          ))}
        </ul>
      )}
    </Panel>
  );
}
