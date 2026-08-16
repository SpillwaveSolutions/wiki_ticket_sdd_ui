# Screen: Read-only panels

## Goal
Show the whole SDD project at once. Each panel is a route from PANELS. None mutate the target repo.

## Panels

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

## Shared states
- **Loading**: spinner in the panel, not a blank page.
- **Empty / missing artifact**: EmptyState, not a crash.
- **Offline GitHub**: degrade; do not block Overview/Board/Docs that can run locally.

## Acceptance Criteria
- [ ] Each PANELS path renders the matching panel heading or primary landmark.
- [ ] Board drawer opens from a card and shows history.
- [ ] Roadmap renders Mermaid when the markdown contains it.
- [ ] Publish plane distinguishes the three drift states.
- [ ] Traceability lets the user walk a node both directions.
- [ ] No control writes to the target repo.

## Notes
- PlantUML Salt: docs/ui/wireframes/. This file is the Guard contract.
