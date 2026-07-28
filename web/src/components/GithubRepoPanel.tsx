import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { CachedRepoInfo, GhRepoCandidate, RepoInfo } from "../lib/types";

interface GithubRepoPanelProps {
  onCloned: (info: RepoInfo) => void;
}

const WORKLOG_CHECK_CONCURRENCY = 6;

/** Runs `fn` over `items` with at most `limit` in flight at once. */
async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

export default function GithubRepoPanel({ onCloned }: GithubRepoPanelProps) {
  const [orgs, setOrgs] = useState<string[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [repos, setRepos] = useState<GhRepoCandidate[]>([]);
  const [worklogEnabled, setWorklogEnabled] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [cloning, setCloning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState<CachedRepoInfo[]>([]);

  useEffect(() => {
    api
      .listGhOrgs()
      .then((list) => {
        setOrgs(list);
        if (list.length > 0) setSelectedOrg(list[0]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingOrgs(false));
    refreshCache();
  }, []);

  useEffect(() => {
    if (!selectedOrg) return;
    let cancelled = false;
    setLoadingRepos(true);
    setError(null);
    setRepos([]);
    setWorklogEnabled({});
    api
      .listOrgRepos(selectedOrg)
      .then(async (list) => {
        if (cancelled) return;
        setRepos(list);
        setLoadingRepos(false);
        setChecking(true);
        await mapWithConcurrency(list, WORKLOG_CHECK_CONCURRENCY, async (repo) => {
          const enabled = await api.checkWorklogEnabled(repo.owner, repo.name).catch(() => false);
          if (!cancelled) {
            setWorklogEnabled((prev) => ({ ...prev, [`${repo.owner}/${repo.name}`]: enabled }));
          }
        });
        if (!cancelled) setChecking(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoadingRepos(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedOrg]);

  function refreshCache() {
    api.listCachedRepos().then(setCached).catch(() => {});
  }

  async function clone(repo: GhRepoCandidate) {
    const key = `${repo.owner}/${repo.name}`;
    setCloning(key);
    setError(null);
    try {
      const info = await api.cloneRepo(repo.owner, repo.name);
      onCloned(info);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCloning(null);
    }
  }

  async function clean(path?: string) {
    try {
      await api.cleanRepoCache(path);
      refreshCache();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const visibleRepos = repos.filter((r) => worklogEnabled[`${r.owner}/${r.name}`]);

  if (loadingOrgs) {
    return <p className="mt-3 text-xs text-slate-500">Checking GitHub CLI…</p>;
  }

  if (orgs.length === 0 && error) {
    return (
      <p className="mt-3 rounded border border-red-800/50 bg-red-500/10 px-2 py-1.5 text-xs text-red-300">
        {error} — install/authenticate the GitHub CLI (<code>gh auth login</code>) to search
        repos here.
      </p>
    );
  }

  return (
    <div className="mt-3">
      <select
        value={selectedOrg ?? ""}
        onChange={(e) => setSelectedOrg(e.target.value)}
        className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200 focus:border-accent focus:outline-none"
      >
        {orgs.map((org, i) => (
          <option key={org} value={org}>
            {i === 0 ? `${org} (you)` : org}
          </option>
        ))}
      </select>

      {error && (
        <p className="mt-2 rounded border border-red-800/50 bg-red-500/10 px-2 py-1.5 text-xs text-red-300">
          {error}
        </p>
      )}

      <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
        Worklog-enabled repos{checking ? " — checking…" : ""}
      </p>
      <ul className="mt-1 max-h-48 space-y-1 overflow-auto">
        {loadingRepos && <li className="text-xs text-slate-600">Loading repos…</li>}
        {!loadingRepos && visibleRepos.length === 0 && !checking && (
          <li className="text-xs text-slate-600">No worklog-enabled repos found in this org.</li>
        )}
        {visibleRepos.map((repo) => {
          const key = `${repo.owner}/${repo.name}`;
          return (
            <li key={key} className="flex items-center justify-between gap-2 rounded px-2 py-1">
              <span className="truncate text-xs text-slate-300" title={repo.description ?? key}>
                {repo.name}
              </span>
              <button
                type="button"
                disabled={cloning === key}
                onClick={() => clone(repo)}
                className="focus-ring shrink-0 rounded bg-accent/15 px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/25 disabled:opacity-50"
              >
                {cloning === key ? "Cloning…" : "Clone & open"}
              </button>
            </li>
          );
        })}
      </ul>

      {cached.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-500">Cached clones</p>
            <button
              type="button"
              onClick={() => clean()}
              className="text-xs text-slate-500 hover:text-red-400"
            >
              Clear all
            </button>
          </div>
          <ul className="mt-1 max-h-24 space-y-1 overflow-auto">
            {cached.map((c) => (
              <li key={c.path} className="flex items-center justify-between rounded px-2 py-1 text-xs text-slate-300">
                <span className="truncate" title={c.path}>
                  {c.owner}/{c.name}
                </span>
                <button
                  type="button"
                  onClick={() => clean(c.path)}
                  className="ml-2 shrink-0 text-slate-500 hover:text-red-400"
                  title="Remove cached clone"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
