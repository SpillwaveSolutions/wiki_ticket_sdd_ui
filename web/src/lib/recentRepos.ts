// Recent-repo history for the repo picker modal. The server takes --repo at
// launch (one active repo per process) so this is dev-workflow convenience
// only: remember paths you've pointed the app at, nothing more.
const STORAGE_KEY = "wiki-ticket-ui:recent-repos";
const MAX_RECENT = 10;

export function getRecentRepos(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function rememberRepo(repoPath: string): string[] {
  const existing = getRecentRepos().filter((p) => p !== repoPath);
  const updated = [repoPath, ...existing].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable (private mode, quota) — history just won't persist
  }
  return updated;
}
