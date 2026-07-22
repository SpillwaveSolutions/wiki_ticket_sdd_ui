# WikiTicket UI

A local, read-only dashboard for any repository that uses
[WikiTicket SDD](https://github.com/SpillwaveSolutions/wiki_ticket_sdd)
("wicked ticket") — spec-driven development with visible WIP, tracked in a
git-native event log.

Point it at a worklog-enabled repo and see the whole project at once: kanban
board, live roadmap with Mermaid diagrams, activity feed, releases, docs
browser with truth-state badges, the wiki publish plane with drift detection,
sync health, charts, and an interactive traceability graph
(plan → item → ticket → PR → release).

## Status

**Pre-build.** This repo currently holds only the scaffold and pointers to the
governing plan. The design is frozen in the main repo:

- Plan: [Plan-wiki-ticket-ui-ia](https://github.com/SpillwaveSolutions/wiki_ticket_sdd/wiki/Plan-wiki-ticket-ui-ia)
  (`docs/plans/2026-07-22-wiki-ticket-ui-ia.md` in
  [SpillwaveSolutions/wiki_ticket_sdd](https://github.com/SpillwaveSolutions/wiki_ticket_sdd))
- Epic: [#113](https://github.com/SpillwaveSolutions/wiki_ticket_sdd/issues/113),
  items [#114–#121](https://github.com/SpillwaveSolutions/wiki_ticket_sdd/issues?q=is%3Aissue+113+in%3Abody)

## Design in one paragraph

Generic by construction: the target repo is runtime input (`--repo <path>`),
never baked-in config. The app never reimplements worklog or IA semantics — it
shells out to the target repo's own `bin/worklog` and reads the committed,
deterministic `docs/.index/` plane (inventory, traceability graph, publish
manifest). It never writes to the target repo. Stack: Hono JSON API server +
Vite/React/Tailwind front end; Tauri desktop shell later.

## Quickstart

Not yet — the server and web app arrive with the first build wave. When they
land: `npm start -- --repo /path/to/your/worklog/repo`.
