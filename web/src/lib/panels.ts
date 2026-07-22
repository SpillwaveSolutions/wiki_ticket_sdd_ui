// Single source of truth for the panel list: nav links (SideNav) and routes
// (App) both read this. Adding a panel means adding one entry here plus one
// file in src/panels/ — nothing else needs to change.
import type { ComponentType } from "react";
import Overview from "../panels/Overview";
import Board from "../panels/Board";
import Roadmap from "../panels/Roadmap";
import Activity from "../panels/Activity";
import Releases from "../panels/Releases";
import Docs from "../panels/Docs";
import PublishPlane from "../panels/PublishPlane";
import SyncHealth from "../panels/SyncHealth";
import Charts from "../panels/Charts";
import Traceability from "../panels/Traceability";

export interface PanelDef {
  path: string;
  label: string;
  Component: ComponentType;
}

export const PANELS: PanelDef[] = [
  { path: "/", label: "Overview", Component: Overview },
  { path: "/board", label: "Board", Component: Board },
  { path: "/roadmap", label: "Roadmap", Component: Roadmap },
  { path: "/activity", label: "Activity", Component: Activity },
  { path: "/releases", label: "Releases", Component: Releases },
  { path: "/docs", label: "Docs", Component: Docs },
  { path: "/publish-plane", label: "Publish plane", Component: PublishPlane },
  { path: "/sync-health", label: "Sync health", Component: SyncHealth },
  { path: "/charts", label: "Charts", Component: Charts },
  { path: "/traceability", label: "Traceability", Component: Traceability },
];
