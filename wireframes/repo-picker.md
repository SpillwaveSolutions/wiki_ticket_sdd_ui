# Screen: Repo picker

## Goal
Choose the single worklog-enabled repo this session reads. On desktop with no repo, the picker opens on first launch instead of leaving every panel in error.

## Layout

Three tabs:

```
+------------------------------------------------+
| Open a worklog repo                            |
| [ Recent | Local | GitHub ]                    |
|                                                |
| Recent: previous paths + Choose folder...      |
| Local: configured scan roots, worklog repos    |
| GitHub: gh repo list, filter, clone to cache   |
+------------------------------------------------+
```

## Key Elements

| Element | Type | Behavior / Notes |
|---------|------|------------------|
| Recent | list | Prior repos plus native folder dialog |
| Local | list | Roots persist in ~/.config/wicked_ticket/config.json |
| GitHub | browse | Requires authenticated gh. Shallow clone cache under ~/.config/wicked_ticket/clones/. Cache can be cleared. |
| WORKLOG_REPO | env | If valid at launch, skip picker |

## Acceptance Criteria
- [ ] Dialog is role=dialog and has the three tabs.
- [ ] Desktop with no repo auto-opens the picker.
- [ ] Choosing a repo loads panels; the app still does not write to that repo.
- [ ] GitHub tab is usable only when gh is authenticated; otherwise it explains the gap.

## Notes
- Sources: RepoPickerModal.tsx, LocalRootsPanel.tsx, GithubRepoPanel.tsx.
