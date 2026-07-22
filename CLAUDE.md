# WikiTicket UI — agent instructions

This repo is the **deliverable** of a plan that lives elsewhere. Read this
before doing anything.

## Where the truth lives

- **Governing plan (frozen):** `docs/plans/2026-07-22-wiki-ticket-ui-ia.md` in
  the main repo — locally at `../wiki_ticket_sdd`, on GitHub at
  [SpillwaveSolutions/wiki_ticket_sdd](https://github.com/SpillwaveSolutions/wiki_ticket_sdd),
  published as
  [Plan-wiki-ticket-ui-ia](https://github.com/SpillwaveSolutions/wiki_ticket_sdd/wiki/Plan-wiki-ticket-ui-ia).
  Read it before implementing anything here.
- **Work tracking:** ALL work on this UI is tracked in the MAIN repo's worklog
  (`../wiki_ticket_sdd/.work/todo.jsonl`, epic `01KY5VY0TDSWJE6W80CNCWA8QA`,
  GitHub epic #113, items #114–#121). This repo is not a second tracker — do
  not add a `.work/` here. Record items with `../wiki_ticket_sdd/bin/worklog`.
- **Design changes:** plans are frozen. If the design must change, write a NEW
  superseding plan in the main repo (see its CLAUDE.md), never edit the plan
  or fork the design here. `docs/plans/` in this repo holds pointers only.

## Non-negotiable design rules (from the plan)

1. **Generic by construction.** The target repo is runtime input (CLI arg /
   env / repo picker). Never hardcode paths, repo names, or GitHub coords —
   derive them from the target's `.work/config.yml` and git remotes.
2. **Never reimplement worklog or IA semantics.** Shell out to the target
   repo's own `bin/worklog` (fold, ia-index, trace-check) and read its
   committed `docs/.index/` plane (`_inventory.json`, `_graph.json`,
   `publish-manifest.json`). Do not parse doc frontmatter to classify
   documents — frozen docs keep metadata in sidecars; `_inventory.json` is
   the merged truth.
3. **Read-only guarantee.** This app NEVER writes to the target repo.
4. **Degrade gracefully.** `gh` CLI when available, unauthenticated REST
   fallback, and full offline function for all file-based panels.

## Dogfood target

Develop and verify against `../wiki_ticket_sdd` (the real repo this was born
from), plus a fresh `init.sh`-scaffolded throwaway repo for the generic-repo
proof. The plan's Verification section lists the acceptance checks.
