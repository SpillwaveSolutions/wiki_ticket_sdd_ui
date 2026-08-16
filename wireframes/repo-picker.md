# Screen: Repo picker

## Goal
Choose the single worklog-enabled repo this session reads. On desktop with no repo (or a path that is not a worklog repo), the picker auto-opens so panels are not left in a red error state.

## Layout

```
+------------------------------------------------+
| Repo                                           |
| Current: <path or none selected>               |
| [error banner]                                 |
|                                                |
| Tauri: [Choose folder…]                        |
| Tauri tabs: [ recent | local | GitHub ]        |
|                                                |
| Recent list  OR  LocalRootsPanel  OR  GitHub   |
| Browser: path field + Remember (no live switch)|
| [Close]                                        |
+------------------------------------------------+
```

Clicking the dimmed backdrop or Close dismisses. This is a `div` overlay — it does **not** set `role=dialog`.

## Key Elements

| Element | Type | Behavior / Notes |
|---------|------|------------------|
| Title | heading | **Repo** |
| Current | text | `repo.repo_path` or none selected |
| Choose folder | button | Tauri only. Native folder dialog. Cancel is not an error. |
| Tabs | recent / local / GitHub | **Tauri only.** Browser has no tabs. |
| Recent | list | Prior paths. Tauri: click selects. Browser: display only. |
| Local | panel | Scan roots persist in `~/.config/wicked_ticket/config.json`. |
| GitHub | panel | Requires authenticated `gh`. Shallow clone cache under `~/.config/wicked_ticket/clones/`. |
| Browser remember | input | Stores a path for the next launch. Does not switch the live server repo. |
| WORKLOG_REPO | env | If valid at launch, skip the first-open picker. |
| Target | constraint | Folder must contain `.work/config.yml`. |

## States
- **Tauri, no repo / not a worklog repo**: auto-open (TopBar watches the repo API error).
- **Busy**: Choose folder / select disabled, label Working….
- **Select error**: red banner; cancel of the native dialog is silent.
- **Browser**: copy explains `--repo` at server launch; picker only remembers paths.

## Acceptance Criteria
- [ ] Overlay title is Repo. Backdrop or Close dismisses it.
- [ ] Desktop (Tauri) with no repo or a non-worklog path auto-opens the picker.
- [ ] Tauri shows the three tabs; choosing a valid worklog repo reloads the window.
- [ ] Browser does not switch repos live; it can remember a path for the next launch.
- [ ] GitHub tab is Tauri-only and explains the gap when `gh` is not authenticated.
- [ ] After a repo is chosen, the app still does not write to that repo.

## Notes
- Sources: RepoPickerModal.tsx, LocalRootsPanel.tsx, GithubRepoPanel.tsx, TopBar.tsx.
