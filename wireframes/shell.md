# Screen: App chrome (shell)

## Goal
Pick a worklog-enabled repo and switch among ten read-only panels without losing context.

## Layout

```
+--------------------------------------------------------------+
| TopBar: WikiTicket UI | repo name / branch / tag / dirty /   |
|                       | version skew | [Repo]                |
+------------+-------------------------------------------------+
| Overview   |                                                 |
| Board      |              Active panel                       |
| Roadmap    |                                                 |
| Activity   |                                                 |
| Releases   |                                                 |
| Docs       |                                                 |
| Publish    |                                                 |
| Sync       |                                                 |
| Charts     |                                                 |
| Trace      |                                                 |
+------------+-------------------------------------------------+
```

Nav and routes share `PANELS` in `web/src/lib/panels.ts`. Adding a panel is one entry plus one file in `web/src/panels/`.

## Key Elements

| Element | Type | Behavior / Notes |
|---------|------|------------------|
| Product | text | WikiTicket UI |
| Repo summary | header | Name, branch, latest tag, dirty, version skew. Loading spinner or `repo: <error>`. |
| Repo button | button | Label is **Repo**. Opens the picker overlay. |
| SideNav | 10 links | Labels from `PANELS`. Active uses accent. `/` uses `end` so Overview is not active on other routes. |
| Main | outlet | One panel component |
| Empty / error | panel | When no repo or API error |

## States
- **Repo loading**: spinner in the TopBar.
- **Repo error**: red `repo: …` text; Tauri auto-opens picker for “no repo selected” / “not a worklog repo”.
- **Repo ok**: name + optional branch/tag/dirty/skew badges.

## Acceptance Criteria
- [ ] All ten panel labels appear in the side nav in `PANELS` order.
- [ ] Active route is visually marked; Overview uses end-match on `/`.
- [ ] Repo button opens the picker without leaving the current panel route.
- [ ] UI is read-only against the target repo.

## Notes
- Sources: web/src/components/SideNav.tsx, TopBar.tsx, web/src/lib/panels.ts.
