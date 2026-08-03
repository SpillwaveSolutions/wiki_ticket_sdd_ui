---
title: Screen specifications
slug: ui-screens
doc_type: uispec
truth_state: living
wiki_key: ui/screens
---

# Screen specifications

Per-screen purpose and structure for WikiTicket UI. Wireframe renders and the
full gallery: [[WikiTicket-UI-Wireframes]] (guide) / in-repo `docs/ui/wireframes/`.

Standing rules for every panel:

1. Read-only against the target worklog repo — never write.
2. Data via `web/src/lib/api.ts` only (`fetch` web / `invoke` Tauri).
3. Shell: TopBar + SideNav from `web/src/App.tsx`; panels in `web/src/panels/`.
4. Empty / loading / error states use shared `EmptyState` / `Spinner` patterns.

---

## `/` — Overview

**Source:** `web/src/panels/Overview.tsx` · **Wireframe:** `overview.puml`

Landing dashboard: open / in progress / blocked / epics-in-flight / latest
release / last status report; milestone progress; 30-day sparkline.

## `/board` — Board

**Source:** `web/src/panels/Board.tsx` · **Wireframe:** `board.puml`

Kanban: Todo · In progress · Blocked · Recently done (14-day close window or
top 20 done). Card → detail drawer with badges + event history.

## `/roadmap` — Roadmap

**Source:** `web/src/panels/Roadmap.tsx` · **Wireframe:** `roadmap.puml`

Renders `docs/roadmap.md` (frontmatter stripped client-side): H2 TOC, GFM,
lazy Mermaid.

## `/activity` — Activity

**Source:** `web/src/panels/Activity.tsx` · **Wireframe:** `activity.puml`

Merged worklog + git + release feed; source checkboxes; worklog op filter;
capped list.

## `/releases` — Releases

**Source:** `web/src/panels/Releases.tsx` · **Wireframe:** `releases.puml`

GitHub releases with linked roadmap snapshots; offline when no API.

## `/docs` — Docs

**Source:** `web/src/panels/Docs.tsx` · **Wireframe:** `docs.puml`

Inventory browser (`docs/.index/_inventory.json`): search, truth filter, list +
content pane, supersede chain awareness.

## `/publish-plane` — Publish plane

**Source:** `web/src/panels/PublishPlane.tsx` · **Wireframe:** `publish-plane.puml`

Ledger vs manifest drift: in-sync / pending / source-drift / unknown.

## `/sync-health` — Sync health

**Source:** `web/src/panels/SyncHealth.tsx` · **Wireframe:** `sync-health.puml`

`.work/sync-state.json` cursors, unpushed opens, orphan/conflict attention.

## `/charts` — Charts

**Source:** `web/src/panels/Charts.tsx` · **Wireframe:** `charts.puml`

Burnup, kind mix, velocity (12 weeks), unplanned ratio (12 weeks).

## `/traceability` — Traceability

**Source:** `web/src/panels/Traceability.tsx` · **Wireframe:** `traceability.puml`

`_graph.json` explorer + `worklog trace-check` checklist; `?node=` deep link.

## Repo picker (modal)

**Source:** `web/src/components/RepoPickerModal.tsx` · **Wireframe:** `repo-picker.puml`

Web: remember paths only. Tauri: native folder dialog, Local roots scan, GitHub
clone cache.
