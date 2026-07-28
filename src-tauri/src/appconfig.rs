//! App-level config (`~/.config/wicked_ticket/config.json`) — repo roots the
//! picker scans for local checkouts, and the managed shallow-clone cache used
//! for repos discovered via GitHub search. Distinct from any target repo's own
//! `.work/config.yml`: this is per-machine app state, never the read-only
//! target.

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};

use crate::error::CmdError;

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AppConfig {
    #[serde(default)]
    pub repo_roots: Vec<String>,
}

fn config_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".config").join("wicked_ticket")
}

pub fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

pub fn cache_root() -> PathBuf {
    config_dir().join("clones")
}

pub fn load() -> AppConfig {
    let path = config_path();
    let Ok(raw) = fs::read_to_string(&path) else {
        return AppConfig::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

pub fn save(config: &AppConfig) -> Result<(), CmdError> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| CmdError::internal(format!("failed to create config dir: {e}")))?;
    }
    let raw = serde_json::to_string_pretty(config)
        .map_err(|e| CmdError::internal(format!("failed to serialize config: {e}")))?;
    fs::write(&path, raw).map_err(|e| CmdError::internal(format!("failed to write config: {e}")))
}

pub fn add_root(path: String) -> Result<Vec<String>, CmdError> {
    let mut config = load();
    if !config.repo_roots.iter().any(|r| r == &path) {
        config.repo_roots.push(path);
    }
    save(&config)?;
    Ok(config.repo_roots)
}

pub fn remove_root(path: &str) -> Result<Vec<String>, CmdError> {
    let mut config = load();
    config.repo_roots.retain(|r| r != path);
    save(&config)?;
    Ok(config.repo_roots)
}

#[derive(Debug, Serialize)]
pub struct LocalRepoCandidate {
    pub path: String,
    pub name: String,
    pub worklog_enabled: bool,
}

/// One level deep only: each root is a folder *containing* repos, not a repo itself.
pub fn scan_local_repos() -> Vec<LocalRepoCandidate> {
    let config = load();
    let mut out = Vec::new();
    for root in &config.repo_roots {
        let root_path = Path::new(root);
        let Ok(entries) = fs::read_dir(root_path) else {
            continue;
        };
        for entry in entries.flatten() {
            let child = entry.path();
            if !child.is_dir() || !child.join(".git").exists() {
                continue;
            }
            let name = child
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            out.push(LocalRepoCandidate {
                worklog_enabled: child.join(".work").join("config.yml").exists(),
                path: child.to_string_lossy().to_string(),
                name,
            });
        }
    }
    out
}

#[derive(Debug, Serialize)]
pub struct CachedRepoInfo {
    pub owner: String,
    pub name: String,
    pub path: String,
}

/// `cache_root()/<owner>/<name>`, two levels deep.
pub fn list_cached_repos() -> Vec<CachedRepoInfo> {
    let root = cache_root();
    let mut out = Vec::new();
    let Ok(owners) = fs::read_dir(&root) else {
        return out;
    };
    for owner_entry in owners.flatten() {
        let owner_path = owner_entry.path();
        if !owner_path.is_dir() {
            continue;
        }
        let owner = owner_path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let Ok(repos) = fs::read_dir(&owner_path) else {
            continue;
        };
        for repo_entry in repos.flatten() {
            let repo_path = repo_entry.path();
            if !repo_path.is_dir() {
                continue;
            }
            let name = repo_path.file_name().unwrap_or_default().to_string_lossy().to_string();
            out.push(CachedRepoInfo {
                owner: owner.clone(),
                name,
                path: repo_path.to_string_lossy().to_string(),
            });
        }
    }
    out
}

/// Refuses to delete anything outside `cache_root()` — this must never be
/// usable to remove an arbitrary `repo_roots` entry or any other path.
pub fn clean_cache(path: Option<String>) -> Result<(), CmdError> {
    let root = cache_root();
    match path {
        None => {
            if root.exists() {
                fs::remove_dir_all(&root)
                    .map_err(|e| CmdError::internal(format!("failed to clear cache: {e}")))?;
            }
            Ok(())
        }
        Some(p) => {
            let target = PathBuf::from(&p);
            if !target.starts_with(&root) {
                return Err(CmdError::bad_request(format!(
                    "refusing to remove path outside the managed cache: {p}"
                )));
            }
            if target.exists() {
                fs::remove_dir_all(&target)
                    .map_err(|e| CmdError::internal(format!("failed to remove {p}: {e}")))?;
            }
            Ok(())
        }
    }
}

#[allow(dead_code)]
pub fn empty_config_json() -> serde_json::Value {
    json!({ "repo_roots": [] })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // HOME is process-global env; serialize tests that touch it.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    fn with_temp_home<F: FnOnce()>(f: F) {
        let _guard = ENV_LOCK.lock().unwrap();
        let dir = std::env::temp_dir().join(format!("wt-appconfig-{}-{:?}", std::process::id(), std::thread::current().id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let old_home = std::env::var("HOME").ok();
        std::env::set_var("HOME", &dir);
        f();
        match old_home {
            Some(h) => std::env::set_var("HOME", h),
            None => std::env::remove_var("HOME"),
        }
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn load_missing_config_is_empty() {
        with_temp_home(|| {
            let config = load();
            assert!(config.repo_roots.is_empty());
        });
    }

    #[test]
    fn add_and_remove_root_roundtrip() {
        with_temp_home(|| {
            let roots = add_root("/tmp/example/src".to_string()).unwrap();
            assert_eq!(roots, vec!["/tmp/example/src".to_string()]);
            // dedup
            let roots = add_root("/tmp/example/src".to_string()).unwrap();
            assert_eq!(roots.len(), 1);
            let roots = remove_root("/tmp/example/src").unwrap();
            assert!(roots.is_empty());
        });
    }

    #[test]
    fn scan_local_repos_filters_git_and_worklog() {
        with_temp_home(|| {
            let root_dir = std::env::temp_dir().join(format!("wt-scan-root-{}", std::process::id()));
            let _ = fs::remove_dir_all(&root_dir);
            fs::create_dir_all(root_dir.join("plain-repo").join(".git")).unwrap();
            fs::create_dir_all(root_dir.join("worklog-repo").join(".git")).unwrap();
            fs::create_dir_all(root_dir.join("worklog-repo").join(".work")).unwrap();
            fs::write(root_dir.join("worklog-repo").join(".work").join("config.yml"), "version: 1\n").unwrap();
            fs::create_dir_all(root_dir.join("not-a-repo")).unwrap();

            add_root(root_dir.to_string_lossy().to_string()).unwrap();
            let mut candidates = scan_local_repos();
            candidates.sort_by(|a, b| a.name.cmp(&b.name));

            assert_eq!(candidates.len(), 2);
            assert_eq!(candidates[0].name, "plain-repo");
            assert!(!candidates[0].worklog_enabled);
            assert_eq!(candidates[1].name, "worklog-repo");
            assert!(candidates[1].worklog_enabled);

            let _ = fs::remove_dir_all(&root_dir);
        });
    }

    #[test]
    fn clean_cache_rejects_paths_outside_cache_root() {
        with_temp_home(|| {
            let outside = std::env::temp_dir().join(format!("wt-outside-{}", std::process::id()));
            fs::create_dir_all(&outside).unwrap();
            let err = clean_cache(Some(outside.to_string_lossy().to_string())).unwrap_err();
            assert_eq!(err.status, 400);
            assert!(outside.exists());
            let _ = fs::remove_dir_all(&outside);
        });
    }

    #[test]
    fn clean_cache_removes_one_entry_and_all() {
        with_temp_home(|| {
            let repo_dir = cache_root().join("acme").join("widgets");
            fs::create_dir_all(&repo_dir).unwrap();
            clean_cache(Some(repo_dir.to_string_lossy().to_string())).unwrap();
            assert!(!repo_dir.exists());

            fs::create_dir_all(cache_root().join("acme").join("gadgets")).unwrap();
            clean_cache(None).unwrap();
            assert!(!cache_root().exists());
        });
    }
}
