// One color-coded pill for every axis panels need to badge: worklog
// level/kind/priority/status, and doc truth_state (+ the wiki-ledger drift
// state, which reuses the same visual language). Panels pass `axis` + the
// raw value; this file owns the color map so badges look the same everywhere.
type BadgeAxis = "level" | "kind" | "priority" | "status" | "truth_state" | "drift";

const PALETTES: Record<BadgeAxis, Record<string, string>> = {
  level: {
    epic: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    story: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    task: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    subtask: "bg-slate-600/15 text-slate-400 border-slate-600/30",
  },
  kind: {
    feature: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    bug: "bg-red-500/15 text-red-300 border-red-500/30",
    ops: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    triage: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  },
  priority: {
    P0: "bg-red-500/15 text-red-300 border-red-500/30",
    P1: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    P2: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    P3: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  },
  status: {
    todo: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    in_progress: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    blocked: "bg-red-500/15 text-red-300 border-red-500/30",
    done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    cancelled: "bg-slate-700/15 text-slate-500 border-slate-700/30",
  },
  truth_state: {
    current: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    snapshot: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    superseded: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    archived: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  },
  drift: {
    "in-sync": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    "source-drift": "bg-red-500/15 text-red-300 border-red-500/30",
    unknown: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  },
};

const FALLBACK = "bg-slate-500/15 text-slate-300 border-slate-500/30";

interface BadgeProps {
  axis: BadgeAxis;
  value: string;
  className?: string;
}

export default function Badge({ axis, value, className = "" }: BadgeProps) {
  const palette = PALETTES[axis][value] ?? FALLBACK;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 ${palette} ${className}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}
