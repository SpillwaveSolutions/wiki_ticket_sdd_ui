# Screen: App chrome (shell)

## Goal
Pick a worklog-enabled repo and switch among ten read-only panels without losing context.

## Layout

```
+--------------------------------------------------------------+
| TopBar: product name, current repo, Change repo              |
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

Nav and routes share `PANELS` in web/src/lib/panels.ts. Adding a panel is one entry plus one file in web/src/panels/.

## Key Elements

| Element | Type | Behavior / Notes |
|---------|------|------------------|
| TopBar | header | Current repo path; Change repo opens picker |
| SideNav | 10 links | Labels from PANELS. Active uses accent |
| Main | outlet | One panel component |
| Empty / error | panel | When no repo or API error |

## Acceptance Criteria
- [ ] All ten panel labels appear in the side nav in PANELS order.
- [ ] Active route is visually marked; Overview uses end-match on /.
- [ ] Change repo opens the picker without leaving the current panel route.
- [ ] UI is read-only against the target repo.

## Notes
- Sources: web/src/components/SideNav.tsx, TopBar.tsx, web/src/lib/panels.ts.
