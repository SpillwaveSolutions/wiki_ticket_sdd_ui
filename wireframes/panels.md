# Screen: Read-only panels

## Goal
Show the whole SDD project at once. Each panel is a route from `PANELS`. None mutate the target repo.

## Layout

One panel fills the main column. Shared chrome is in `shell.md`.

## Key Elements

| Panel | Must show |
|-------|-----------|
| Overview | Open / in-progress / blocked counts, epics in flight, latest release, milestone bars, 30-day sparkline |
| Board | Columns todo / in progress / blocked / recently done; item drawer with event history |
| Roadmap | docs/roadmap.md live: headings, GFM tables, Mermaid, TOC |
| Activity | Merged feed of worklog events, commits, GitHub releases; filterable |
| Releases | GitHub release timeline + frozen roadmap snapshots |
| Docs | Inventory browser with truth-state badges, search/filter, supersede chains |
| Publish plane | Three-way drift: in-sync, pending-republish, source-drift |
| Sync health | sync-state cursors, unpushed open items, orphan/conflict alerts |
| Charts | Burnup, kind mix, weekly velocity, unplanned-work ratio |
| Traceability | Interactive graph plan to item to ticket to PR to release; trace-check checklist |

## States
- **Loading**: spinner in the panel, not a blank page.
- **Empty / missing artifact**: EmptyState, not a crash.
- **Offline GitHub**: degrade; do not block Overview/Board/Docs that can run locally.

- **No worklog repo**: guided empty state (not a raw 400 path). Copy explains this is a WikiTicket SDD folder. **Choose repo** opens the picker. **Load sample worklog** (`data-testid=load-sample-worklog`) activates an offline sample corpus so Overview, Board, Roadmap, Activity, Releases, Charts, **Docs**, and **Traceability** can be explored without a real repo.

## Acceptance Criteria
- [ ] Each `PANELS` path renders the matching panel heading or primary landmark.
- [ ] Board drawer opens from a card and shows history.
- [ ] Roadmap renders Mermaid when the markdown contains it.
- [ ] Publish plane distinguishes the three drift states.
- [ ] Traceability lets the user walk a node both directions.
- [ ] No control writes to the target repo.
- [ ] A missing worklog repo shows a guided empty state with Choose repo, not a raw API path.
- [ ] Guided empty state includes **Load sample worklog** which enables sample mode (session) and returns fixture items/events/repo for core panels.
- [ ] Sample mode also returns fixture roadmap markdown (with a Mermaid block), git log, and one release so Roadmap, Activity, and Releases render offline.
- [ ] Sample mode returns fixture docs inventory (with truth-state + a supersede chain) and doc content so Docs renders offline.
- [ ] Sample mode returns a fixture graph (plan → item → ticket → PR → release) and a clean trace-check so Traceability renders offline.

## Notes
- PlantUML Salt: docs/ui/wireframes/. This file is the Guard contract.
- Sample fixtures live in `web/src/lib/sample.ts`; mode flag `sessionStorage["wiki-ticket-sample"]`.
