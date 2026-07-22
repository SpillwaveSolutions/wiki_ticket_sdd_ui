import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import type { WorklogEvent, WorklogItem } from "../lib/types";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import Badge from "../components/Badge";
import { EmptyState, ErrorState } from "../components/EmptyState";

// Panel 2 — see docs/plans/2026-07-22-wiki-ticket-ui-ia.md panel 2 (Board).

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

type ColumnKey = "todo" | "in_progress" | "blocked" | "recently_done";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "todo", label: "Todo" },
  { key: "in_progress", label: "In progress" },
  { key: "blocked", label: "Blocked" },
  { key: "recently_done", label: "Recently done" },
];

/**
 * External-issue reference, normalized from the (loosely typed) `external`
 * field. Real repo data is a flat object `{system, key, url, ...}`, but the
 * shape isn't schema-enforced, so this also tolerates a `{github: {...}}`
 * wrapper and an array of refs (first entry wins).
 * Candidate for extraction to lib/types.ts + lib/api.ts if another panel
 * needs GitHub-issue linking (Docs/Releases/Traceability all plausibly will).
 */
interface ExternalRef {
  system?: string;
  key?: string | number;
  url?: string;
}

function normalizeExternal(raw: unknown): ExternalRef | null {
  if (!raw || typeof raw !== "object") return null;
  if (Array.isArray(raw)) {
    const first = raw.find((r) => r && typeof r === "object");
    return first ? normalizeExternal(first) : null;
  }
  const obj = raw as Record<string, unknown>;
  if (obj.github && typeof obj.github === "object") {
    const gh = obj.github as Record<string, unknown>;
    return { system: "github", key: gh.key as string | number | undefined, url: gh.url as string | undefined };
  }
  if ("key" in obj || "number" in obj || "url" in obj) {
    return {
      system: obj.system as string | undefined,
      key: (obj.key ?? obj.number) as string | number | undefined,
      url: obj.url as string | undefined,
    };
  }
  return null;
}

/** Buckets items into the four board columns. "recently done" = closed in
 * the last 14 days (by the newest `close` event ts for that item); if none
 * qualify, falls back to the 20 newest done items by close ts. */
function bucketItems(items: WorklogItem[], events: WorklogEvent[]): Record<ColumnKey, WorklogItem[]> {
  const closeTsByItem = new Map<string, string>();
  for (const ev of events) {
    if (ev.op === "close" && ev.ts) {
      const existing = closeTsByItem.get(ev.item);
      if (!existing || ev.ts > existing) closeTsByItem.set(ev.item, ev.ts);
    }
  }

  const doneWithTs = items
    .filter((i) => i.status === "done")
    .map((item) => ({ item, ts: closeTsByItem.get(item.id) }));

  const now = Date.now();
  const withinWindow = doneWithTs.filter((x) => x.ts && now - Date.parse(x.ts) <= FOURTEEN_DAYS_MS);

  const recentlyDone =
    withinWindow.length > 0
      ? withinWindow.sort((a, b) => (b.ts ?? "").localeCompare(a.ts ?? "")).map((x) => x.item)
      : doneWithTs
          .sort((a, b) => (b.ts ?? "").localeCompare(a.ts ?? ""))
          .slice(0, 20)
          .map((x) => x.item);

  return {
    todo: items.filter((i) => i.status === "todo"),
    in_progress: items.filter((i) => i.status === "in_progress"),
    blocked: items.filter((i) => i.status === "blocked"),
    recently_done: recentlyDone,
  };
}

function ItemCard({
  item,
  epicTitle,
  onClick,
}: {
  item: WorklogItem;
  epicTitle?: string;
  onClick: () => void;
}) {
  const ext = normalizeExternal(item.external);
  return (
    <button
      onClick={onClick}
      className="glass w-full rounded-lg p-3 text-left transition hover:border-accent/50"
    >
      <p className="mb-2 text-sm font-medium leading-snug text-slate-100">{item.title}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {item.level && <Badge axis="level" value={item.level} />}
        {item.kind && <Badge axis="kind" value={item.kind} />}
        {item.priority && <Badge axis="priority" value={item.priority} />}
        {item.milestone && (
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400">
            {item.milestone}
          </span>
        )}
        {epicTitle && (
          <span className="rounded-full border border-violet-700/40 bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-300">
            epic: {epicTitle}
          </span>
        )}
        {item.unplanned && (
          <span className="rounded-full border border-amber-700/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
            unplanned
          </span>
        )}
        {ext?.key != null && (
          <a
            href={ext.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-accent hover:underline"
          >
            #{ext.key}
          </a>
        )}
      </div>
    </button>
  );
}

function ItemDrawer({
  item,
  events,
  onClose,
}: {
  item: WorklogItem;
  events: WorklogEvent[];
  onClose: () => void;
}) {
  const history = events
    .filter((ev) => ev.item === item.id)
    .sort((a, b) => (b.ts ?? "").localeCompare(a.ts ?? ""));

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
      <aside className="glass relative z-50 h-full w-full max-w-md overflow-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">{item.title}</h2>
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-200">
            Close
          </button>
        </div>
        <pre className="mb-4 overflow-auto rounded-lg bg-slate-900/80 p-3 text-xs text-slate-300">
          {JSON.stringify(item, null, 2)}
        </pre>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Event history ({history.length})
        </h3>
        {history.length === 0 ? (
          <p className="text-xs text-slate-500">No events found for this item.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((ev) => (
              <li key={ev.ev} className="rounded-lg border border-slate-800 px-3 py-2 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-medium text-slate-200">{ev.op}</span>
                  <span>{ev.ts}</span>
                </div>
                {ev.actor && <p className="mt-1 text-slate-500">actor: {ev.actor}</p>}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

function BoardBody({ items, events }: { items: WorklogItem[]; events: WorklogEvent[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const buckets = useMemo(() => bucketItems(items, events), [items, events]);
  const selected = selectedId ? byId.get(selectedId) : undefined;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const columnItems = buckets[col.key];
          return (
            <div key={col.key} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>{col.label}</span>
                <span>{columnItems.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {columnItems.length === 0 ? (
                  <EmptyState title="Nothing here" />
                ) : (
                  columnItems.map((item) => {
                    const parent = item.parent ? byId.get(item.parent) : undefined;
                    return (
                      <ItemCard
                        key={item.id}
                        item={item}
                        epicTitle={parent?.level === "epic" ? parent.title : undefined}
                        onClick={() => setSelectedId(item.id)}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
      {selected && <ItemDrawer item={selected} events={events} onClose={() => setSelectedId(null)} />}
    </>
  );
}

export default function Board() {
  const items = useApi(() => api.getItems(), []);
  const events = useApi(() => api.getEvents(), []);

  return (
    <Panel title="Board">
      {items.status === "loading" && <Spinner label="Loading /api/items…" />}
      {items.status === "error" && <ErrorState message={items.error} />}
      {items.status === "ok" && (
        <BoardBody items={items.data} events={events.status === "ok" ? events.data : []} />
      )}
    </Panel>
  );
}
