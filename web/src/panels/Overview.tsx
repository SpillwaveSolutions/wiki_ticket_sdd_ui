import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import type { InventoryDoc, WorklogEvent, WorklogItem } from "../lib/types";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import StatCard from "../components/StatCard";
import { ErrorState } from "../components/EmptyState";

// Panel 1 — see docs/plans/2026-07-22-wiki-ticket-ui-ia.md panel 1 (Overview).

function countByStatus(items: WorklogItem[], status: WorklogItem["status"]): number {
  return items.filter((i) => i.status === status).length;
}

function epicsInFlight(items: WorklogItem[]): number {
  return items.filter(
    (i) => i.level === "epic" && (i.status === "todo" || i.status === "in_progress" || i.status === "blocked"),
  ).length;
}

/** Newest `date` among doc_type "status" inventory docs, in whole days since now. */
function daysSinceLastStatus(docs: InventoryDoc[]): number | null {
  const dates = docs
    .filter((d) => d.doc_type === "status" && typeof d.date === "string")
    .map((d) => d.date as string);
  if (dates.length === 0) return null;
  const latest = dates.reduce((max, d) => (d > max ? d : max));
  const diffMs = Date.now() - Date.parse(latest);
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function formatDaysSince(days: number | null): string {
  if (days === null) return "none yet";
  if (days === 0) return "today";
  return `${days}d ago`;
}

function MilestoneProgress({ items }: { items: WorklogItem[] }) {
  const byMilestone = new Map<string, { done: number; total: number }>();
  for (const it of items) {
    if (!it.milestone) continue;
    const bucket = byMilestone.get(it.milestone) ?? { done: 0, total: 0 };
    bucket.total += 1;
    if (it.status === "done") bucket.done += 1;
    byMilestone.set(it.milestone, bucket);
  }
  const milestones = [...byMilestone.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  if (milestones.length === 0) {
    return <p className="text-sm text-slate-500">No milestones assigned yet.</p>;
  }

  return (
    <div className="space-y-2.5">
      {milestones.map(([name, { done, total }]) => (
        <div key={name}>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-300">{name}</span>
            <span>
              {done}/{total}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Per-day event counts for the last 30 days, oldest first. */
function sparklineData(events: WorklogEvent[]): { date: string; count: number }[] {
  const days = 30;
  const counts = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    counts.set(d.toISOString().slice(0, 10), 0);
  }
  for (const ev of events) {
    if (!ev.ts) continue;
    const day = ev.ts.slice(0, 10);
    if (counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()].map(([date, count]) => ({ date, count }));
}

function ActivitySparkline({ events }: { events: WorklogEvent[] }) {
  const data = sparklineData(events);
  return (
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={data}>
        <Area type="monotone" dataKey="count" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.25} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function Overview() {
  const items = useApi(() => api.getItems(), []);
  const events = useApi(() => api.getEvents(), []);
  const repo = useApi(() => api.getRepo(), []);
  const docs = useApi(() => api.getDocs(), []);

  return (
    <Panel title="Overview">
      {items.status === "loading" && <Spinner label="Loading /api/items…" />}
      {items.status === "error" && <ErrorState message={items.error} />}
      {items.status === "ok" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Open" value={countByStatus(items.data, "todo")} />
            <StatCard label="In progress" value={countByStatus(items.data, "in_progress")} />
            <StatCard label="Blocked" value={countByStatus(items.data, "blocked")} />
            <StatCard label="Epics in flight" value={epicsInFlight(items.data)} />
            <StatCard
              label="Latest release"
              value={repo.status === "ok" ? (repo.data.latest_tag ?? "—") : "…"}
            />
            <StatCard
              label="Last status report"
              value={docs.status === "ok" ? formatDaysSince(daysSinceLastStatus(docs.data.docs)) : "…"}
            />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-300">Milestone progress</h2>
            <MilestoneProgress items={items.data} />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-slate-300">Activity, last 30 days</h2>
            {events.status === "loading" && <Spinner label="Loading /api/events…" />}
            {events.status === "error" && <ErrorState message={events.error} />}
            {events.status === "ok" && <ActivitySparkline events={events.data} />}
          </div>
        </div>
      )}
    </Panel>
  );
}
