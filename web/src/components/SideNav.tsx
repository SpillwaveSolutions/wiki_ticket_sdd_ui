import { NavLink } from "react-router-dom";
import { PANELS } from "../lib/panels";

export default function SideNav() {
  return (
    <nav className="glass flex w-56 shrink-0 flex-col gap-1 rounded-xl p-3">
      {PANELS.map((panel) => (
        <NavLink
          key={panel.path}
          to={panel.path}
          end={panel.path === "/"}
          className={({ isActive }) =>
            `rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-accent/15 text-accent"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
            }`
          }
        >
          {panel.label}
        </NavLink>
      ))}
    </nav>
  );
}
