---
title: UI design artifacts
slug: ui-design-artifacts
doc_type: uispec
truth_state: living
wiki_key: ui/design-artifacts
---

# UI design artifacts

Wireframes and screen specifications for WikiTicket UI. Salt draws **structure
only**. The full gallery with images is published as
[[WikiTicket-UI-Wireframes]]; per-screen notes as [[Screen-Specifications]].

Lives in `docs/ui/` rather than `docs/designs/`: release design docs own that
tree. The publishable gallery also lives as
`docs/user_guide/wireframes.md` so `worklog ia-index` classifies it as a
living **guide**.

## Layout

```
docs/ui/
  README.md                 this file
  screens.md                per-screen purpose
  wireframes/*.puml         PlantUML Salt sources
  wireframes/*.png          rendered next to sources
docs/images/wireframes/     PNGs referenced by the guide (publish assets)
docs/user_guide/wireframes.md   IA guide + image gallery
```

## Screens

| File | Route / surface |
|------|-----------------|
| `shell-app.puml` | Shared chrome |
| `overview.puml` | `/` |
| `board.puml` | `/board` |
| `roadmap.puml` | `/roadmap` |
| `activity.puml` | `/activity` |
| `releases.puml` | `/releases` |
| `docs.puml` | `/docs` |
| `publish-plane.puml` | `/publish-plane` |
| `sync-health.puml` | `/sync-health` |
| `charts.puml` | `/charts` |
| `traceability.puml` | `/traceability` |
| `repo-picker.puml` | Repo modal |

## Commands

```bash
npm run wireframes          # render every .puml → .png (sources + docs/images/wireframes/)
npm run wireframes:check    # syntax-check only
```

Run `--check-syntax` before render: without it PlantUML can emit a PNG of the
error message. PNG bytes are stable within a PlantUML version, not across them.

## Acceptable differences

- Salt is monochrome boxes; the app is a dark glass workbench
- Icons and badges are labels, not glyphs
- Proportions are schematic
- Desktop-only controls appear only on `repo-picker`
