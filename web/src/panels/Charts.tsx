import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import Panel from "../components/Panel";
import Spinner from "../components/Spinner";
import { ErrorState, EmptyState } from "../components/EmptyState";
import type { ItemKind, WorklogEvent, WorklogItem } from "../lib/types";

// Wave 2: burnup, kind mix, velocity by week, unplanned ratio — driven by
// event ULID timestamps — see plan panel 9. recharts is pre-installed.
//
// All data shaping below is pure and exported so it can be unit-tested
// without rendering recharts (see Charts.test.tsx).

/** ISO-8601 week key, e.g. "2026-W29". Monday-start weeks, per the ISO standard. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function lastNWeekKeys(n: number, now: Date): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  let cursor = new Date(now);
  while (keys.length < n) {
    const key = isoWeekKey(cursor);
    if (!seen.has(key)) {
      seen.add(key);
      keys.unshift(key);
    }
    cursor = new Date(cursor.getTime() - 7 * 86400000);
  }
  return keys;
}

/** Cumulative created vs closed by day, from create/close events. */
export function computeBurnup(events: WorklogEvent[]): { date: string; created: number; closed: number }[] {
  const days = new Map<string, { created: number; closed: number }>();
  for (const ev of events) {
    if (!ev.ts || (ev.op !== "create" && ev.op !== "close")) continue;
    const day = ev.ts.slice(0, 10);
    const entry = days.get(day) ?? { created: 0, closed: 0 };
    if (ev.op === "create") entry.created += 1;
    else entry.closed += 1;
    days.set(day, entry);
  }
  const sortedDays = Array.from(days.keys()).sort();
  let cCreated = 0;
  let cClosed = 0;
  return sortedDays.map((day) => {
    const e = days.get(day)!;
    cCreated += e.created;
    cClosed += e.closed;
    return { date: day, created: cCreated, closed: cClosed };
  });
}

const KINDS: ItemKind[] = ["feature", "bug", "ops", "triage"];

/** Current kind mix — the taxonomy says triage+ops should trend down over time. */
export function computeKindMix(items: WorklogItem[]): { kind: ItemKind; count: number }[] {
  const counts = new Map<ItemKind, number>(KINDS.map((k) => [k, 0]));
  for (const item of items) {
    const kind = item.kind ?? "triage";
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return KINDS.map((k) => ({ kind: k, count: counts.get(k) ?? 0 }));
}

/** Closes per ISO week, last 12 weeks (zero-filled), ending at `now`. */
export function computeVelocity(
  events: WorklogEvent[],
  now: Date = new Date(),
): { week: string; closes: number }[] {
  const weeks = lastNWeekKeys(12, now);
  const counts = new Map(weeks.map((w) => [w, 0]));
  for (const ev of events) {
    if (ev.op !== "close" || !ev.ts) continue;
    const key = isoWeekKey(new Date(ev.ts));
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return weeks.map((w) => ({ week: w, closes: counts.get(w) ?? 0 }));
}

/** Fraction of items created each week that carry `unplanned: true` — the
 * estimate-honesty metric from the work taxonomy. Uses each item's first
 * create event to place it in a week, and its final folded `unplanned` flag. */
export function computeUnplannedRatio(
  events: WorklogEvent[],
  items: WorklogItem[],
  now: Date = new Date(),
): { week: string; ratio: number; total: number }[] {
  const createdWeek = new Map<string, string>();
  for (const ev of events) {
    if (ev.op === "create" && ev.ts && !createdWeek.has(ev.item)) {
      createdWeek.set(ev.item, isoWeekKey(new Date(ev.ts)));
    }
  }
  const itemById = new Map(items.map((i) => [i.id, i]));
  const weeks = lastNWeekKeys(12, now);
  const totals = new Map(weeks.map((w) => [w, 0]));
  const unplanned = new Map(weeks.map((w) => [w, 0]));
  for (const [itemId, week] of createdWeek) {
    if (!totals.has(week)) continue;
    totals.set(week, (totals.get(week) ?? 0) + 1);
    if (itemById.get(itemId)?.unplanned) unplanned.set(week, (unplanned.get(week) ?? 0) + 1);
  }
  return weeks.map((w) => {
    const total = totals.get(w) ?? 0;
    const un = unplanned.get(w) ?? 0;
    return { week: w, total, ratio: total > 0 ? un / total : 0 };
  });
}

const TOOLTIP_STYLE = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  fontSize: 12,
  color: "#e2e8f0",
};
const AXIS_STYLE = { fontSize: 11, fill: "#94a3b8" };
const GRID_STROKE = "#1e293b";

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="glass flex min-h-0 flex-col rounded-xl p-3">
      <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">{title}</p>
      <div className="h-56 min-h-0">{children}</div>
    </div>
  );
}

export default function Charts() {
  const events = useApi(() => api.getEvents(), []);
  const items = useApi(() => api.getItems(), []);

  const loading = events.status === "loading" || items.status === "loading";
  const ready = events.status === "ok" && items.status === "ok";

  const burnup = ready ? computeBurnup(events.data) : [];
  const kindMix = ready ? computeKindMix(items.data) : [];
  const velocity = ready ? computeVelocity(events.data) : [];
  const unplannedRatio = ready ? computeUnplannedRatio(events.data, items.data) : [];

  return (
    <Panel title="Charts">
      {loading && <Spinner label="Loading events + items…" />}
      {events.status === "error" && <ErrorState message={events.error} />}
      {items.status === "error" && <ErrorState message={items.error} />}
      {ready && events.data.length === 0 && items.data.length === 0 && (
        <EmptyState title="No data yet" detail="No worklog events or items in this repo." />
      )}
      {ready && (events.data.length > 0 || items.data.length > 0) && (
        <div className="grid h-full min-h-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <ChartCard title="Burnup (cumulative created vs closed)">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burnup}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={AXIS_STYLE} minTickGap={24} />
                <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="created" stroke="#22d3ee" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="closed" stroke="#34d399" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Kind mix (triage + ops should trend down)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kindMix}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
                <XAxis dataKey="kind" tick={AXIS_STYLE} />
                <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Velocity — closes per ISO week (last 12)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={velocity}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={AXIS_STYLE} minTickGap={16} />
                <YAxis tick={AXIS_STYLE} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="closes" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Unplanned ratio — items created per week (last 12)">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={unplannedRatio}>
                <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
                <XAxis dataKey="week" tick={AXIS_STYLE} minTickGap={16} />
                <YAxis tick={AXIS_STYLE} domain={[0, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value: number) => `${Math.round(value * 100)}%`}
                />
                <Line type="monotone" dataKey="ratio" stroke="#fbbf24" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </Panel>
  );
}
