//! The 13 Tauri commands — full port of server/src/routes.ts.
//! Handlers shell out / read files identically; no worklog/IA reimplementation.

use crate::error::CmdError;
use crate::repo::{self, config_str, config_top_str, load_target_repo, resolve_doc_path};
use crate::state::AppState;
use crate::ulid::ulid_timestamp_iso;
use serde::Serialize;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::MutexGuard;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

// ── shared helpers ──────────────────────────────────────────────────────────

/// Runs a read-only command in the target repo. Never mutates it.
pub fn run(cmd: &str, args: &[&str], cwd: &Path) -> std::io::Result<std::process::Output> {
    Command::new(cmd)
        .args(args)
        .current_dir(cwd)
        .output()
}

fn sha256_12(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let digest = hasher.finalize();
    format!("{digest:x}")[..12].to_string()
}

/// Counts gap lines in `bin/worklog trace-check` output — every non-blank
/// line that isn't the "trace: ..." summary line. Mirrors routes.ts.
fn count_trace_check_gaps(output: &str) -> usize {
    output
        .split('\n')
        .map(|l| l.trim())
        .filter(|l| !l.is_empty() && !l.starts_with("trace:"))
        .count()
}

fn read_jsonl_events(full_path: &Path) -> Vec<Value> {
    if !full_path.exists() {
        return vec![];
    }
    let Ok(raw) = fs::read_to_string(full_path) else {
        return vec![];
    };
    raw.split('\n')
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .filter_map(|l| serde_json::from_str::<Value>(l).ok())
        .collect()
}

fn require_repo<'a>(state: &'a State<'_, AppState>) -> Result<PathBuf, CmdError> {
    let guard: MutexGuard<'_, Option<PathBuf>> = state
        .repo
        .lock()
        .map_err(|_| CmdError::internal("repo state lock poisoned"))?;
    guard
        .clone()
        .ok_or_else(|| CmdError::bad_request("no repo selected"))
}

fn load_config(repo_path: &Path) -> Result<Map<String, Value>, CmdError> {
    let (_, config) = load_target_repo(repo_path)?;
    Ok(config)
}

fn read_json_file(full_path: &Path) -> Result<Value, CmdError> {
    if !full_path.exists() {
        let name = full_path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("file");
        return Err(CmdError::not_found(format!("not found: {name}")));
    }
    let raw = fs::read_to_string(full_path)
        .map_err(|e| CmdError::internal(format!("read failed: {e}")))?;
    serde_json::from_str(&raw)
        .map_err(|e| CmdError::internal(format!("invalid JSON in {}: {e}", full_path.display())))
}

// ── response shapes ─────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct DriftInfo {
    pub dirty: bool,
    pub version_skew: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct RepoInfo {
    pub name: Option<String>,
    pub key: Option<String>,
    pub repo_path: String,
    pub github_project: Option<String>,
    pub wiki_root_url: Option<String>,
    pub branch: Option<String>,
    pub latest_tag: Option<String>,
    pub installed_version: Option<String>,
    pub worklog_version: Option<String>,
    pub drift: DriftInfo,
}

#[derive(Debug, Serialize)]
pub struct RoadmapResponse {
    pub meta: Map<String, Value>,
    pub markdown: String,
}

#[derive(Debug, Serialize)]
pub struct GitCommit {
    pub hash: String,
    pub author: String,
    pub date: String,
    pub subject: String,
}

#[derive(Debug, Serialize)]
pub struct ReleasesResponse {
    pub offline: bool,
    pub releases: Value,
}

#[derive(Debug, Serialize)]
pub struct TraceCheckResponse {
    pub ok: bool,
    pub output: String,
    pub gaps: usize,
}

// ── pure handlers (testable without Tauri) ──────────────────────────────────

pub fn build_repo_info(repo_path: &Path) -> Result<RepoInfo, CmdError> {
    let config = load_config(repo_path)?;

    let branch = run("git", &["rev-parse", "--abbrev-ref", "HEAD"], repo_path)
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    let latest_tag = run("git", &["describe", "--tags", "--abbrev=0"], repo_path)
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string());

    let dirty = run("git", &["status", "--porcelain"], repo_path)
        .ok()
        .filter(|o| o.status.success())
        .map(|o| !String::from_utf8_lossy(&o.stdout).trim().is_empty())
        .unwrap_or(false);

    // CLI prints "worklog X.Y.Z"; config.installed holds bare "X.Y.Z"
    // Mirror Node: stdout.trim().replace(/^worklog\s+/, "")
    let worklog_version = run("python3", &["bin/worklog", "--version"], repo_path)
        .ok()
        .filter(|o| o.status.success())
        .map(|o| {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if let Some(rest) = s.strip_prefix("worklog") {
                rest.trim_start().to_string()
            } else {
                s
            }
        });

    let installed_version = config_top_str(&config, "installed");
    let version_skew = match (&installed_version, &worklog_version) {
        (Some(a), Some(b)) => a != b,
        _ => false,
    };

    Ok(RepoInfo {
        name: config_str(&config, "project", "name"),
        key: config_str(&config, "project", "key"),
        repo_path: repo_path.display().to_string(),
        github_project: config_str(&config, "ticketing", "project"),
        wiki_root_url: config_str(&config, "wiki", "root_url"),
        branch,
        latest_tag,
        installed_version,
        worklog_version,
        drift: DriftInfo {
            dirty,
            version_skew,
        },
    })
}

pub fn build_items(repo_path: &Path) -> Result<Value, CmdError> {
    let output = run("python3", &["bin/worklog", "fold"], repo_path)
        .map_err(|e| CmdError::internal(format!("worklog fold spawn failed: {e}")))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(CmdError::internal(format!(
            "worklog fold failed: {detail}"
        )));
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim())
        .map_err(|_| CmdError::internal("worklog fold produced invalid JSON"))
}

pub fn build_events(repo_path: &Path) -> Result<Value, CmdError> {
    let mut events = Vec::new();
    events.extend(read_jsonl_events(&repo_path.join(".work").join("todo.jsonl")));
    events.extend(read_jsonl_events(&repo_path.join(".work").join("done.jsonl")));

    for ev in &mut events {
        if let Some(obj) = ev.as_object_mut() {
            let has_ts = obj
                .get("ts")
                .and_then(|v| v.as_str())
                .map(|s| !s.is_empty())
                .unwrap_or(false);
            if !has_ts {
                if let Some(ev_id) = obj.get("ev").and_then(|v| v.as_str()) {
                    if let Some(iso) = ulid_timestamp_iso(ev_id) {
                        obj.insert("ts".into(), Value::String(iso));
                    }
                }
            }
        }
    }

    events.sort_by(|a, b| {
        let ta = a.get("ts").and_then(|v| v.as_str()).unwrap_or("");
        let tb = b.get("ts").and_then(|v| v.as_str()).unwrap_or("");
        // descending (newest first), matching Node: a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0
        tb.cmp(ta)
    });

    Ok(Value::Array(events))
}

pub fn build_roadmap(repo_path: &Path) -> Result<RoadmapResponse, CmdError> {
    let config = load_config(repo_path)?;
    let roadmap_rel = config_str(&config, "paths", "roadmap")
        .unwrap_or_else(|| "docs/roadmap.md".to_string());
    let full_path = repo_path.join(&roadmap_rel);
    if !full_path.exists() {
        return Err(CmdError::not_found(format!(
            "roadmap not found: {roadmap_rel}"
        )));
    }
    let markdown = fs::read_to_string(&full_path)
        .map_err(|e| CmdError::internal(format!("read roadmap failed: {e}")))?;

    let mut meta = Map::new();
    if markdown.starts_with("---") {
        if let Some(end_rel) = markdown[3..].find("\n---") {
            let end = 3 + end_rel;
            // frontmatter is between first newline after --- and the closing ---
            if let Some(first_nl) = markdown.find('\n') {
                if first_nl < end {
                    let frontmatter = &markdown[first_nl + 1..end];
                    meta = repo::parse_flat_yaml(frontmatter)
                        .into_iter()
                        .map(|(k, v)| {
                            // flatten one level of nested maps to string values for meta
                            match v {
                                Value::Object(obj) => {
                                    // keep nested as object? Node returns Record from parseFlatYaml
                                    (k, Value::Object(obj))
                                }
                                other => (k, other),
                            }
                        })
                        .collect();
                }
            }
        }
    }
    Ok(RoadmapResponse { meta, markdown })
}

pub fn build_docs(repo_path: &Path) -> Result<Value, CmdError> {
    read_json_file(&repo_path.join("docs").join(".index").join("_inventory.json"))
}

pub fn build_doc_content(repo_path: &Path, requested: &str) -> Result<String, CmdError> {
    if requested.is_empty() {
        return Err(CmdError::bad_request("missing ?path="));
    }
    let full_path = resolve_doc_path(repo_path, requested)?;
    if !full_path.exists() {
        return Err(CmdError::not_found(format!("not found: {requested}")));
    }
    fs::read_to_string(&full_path)
        .map_err(|e| CmdError::internal(format!("read doc failed: {e}")))
}

pub fn build_graph(repo_path: &Path) -> Result<Value, CmdError> {
    read_json_file(&repo_path.join("docs").join(".index").join("_graph.json"))
}

pub fn build_manifest(repo_path: &Path) -> Result<Value, CmdError> {
    read_json_file(
        &repo_path
            .join("docs")
            .join(".index")
            .join("publish-manifest.json"),
    )
}

pub fn build_wiki_ledger(repo_path: &Path) -> Result<Value, CmdError> {
    let ledger_path = repo_path.join(".work").join("published.json");
    let manifest_path = repo_path
        .join("docs")
        .join(".index")
        .join("publish-manifest.json");

    if !ledger_path.exists() {
        return Err(CmdError::not_found("published.json not found"));
    }

    let ledger: Map<String, Value> = {
        let raw = fs::read_to_string(&ledger_path)
            .map_err(|e| CmdError::internal(format!("read ledger failed: {e}")))?;
        serde_json::from_str(&raw)
            .map_err(|e| CmdError::internal(format!("invalid published.json: {e}")))?
    };

    let manifest: Value = if manifest_path.exists() {
        let raw = fs::read_to_string(&manifest_path)
            .map_err(|e| CmdError::internal(format!("read manifest failed: {e}")))?;
        serde_json::from_str(&raw).unwrap_or_else(|_| json!({ "pages": [] }))
    } else {
        json!({ "pages": [] })
    };

    let mut manifest_by_key: HashMap<String, Value> = HashMap::new();
    if let Some(pages) = manifest.get("pages").and_then(|p| p.as_array()) {
        for p in pages {
            if let Some(key) = p.get("wiki_key").and_then(|k| k.as_str()) {
                manifest_by_key.insert(key.to_string(), p.clone());
            }
        }
    }

    let mut with_drift = Map::new();
    for (key, entry) in ledger {
        let mut entry_obj = match entry {
            Value::Object(m) => m,
            other => {
                let mut m = Map::new();
                m.insert("_raw".into(), other);
                m
            }
        };

        let wiki_key = entry_obj
            .get("wiki_key")
            .and_then(|v| v.as_str())
            .unwrap_or(key.as_str())
            .to_string();

        let page = manifest_by_key.get(&wiki_key);
        let drift = if let Some(page) = page {
            let mut source_drift = false;
            let frozen = page.get("frozen").and_then(|v| v.as_bool()).unwrap_or(false);
            let source_hash = entry_obj
                .get("source_hash")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let source = entry_obj
                .get("source")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            if frozen {
                if let (Some(sh), Some(src)) = (&source_hash, &source) {
                    let source_path = repo_path.join(src);
                    if source_path.exists() {
                        if let Ok(bytes) = fs::read(&source_path) {
                            let actual = sha256_12(&bytes);
                            source_drift = actual != *sh;
                        }
                    }
                }
            }

            if source_drift {
                "source-drift"
            } else {
                let page_rh = page.get("render_hash").and_then(|v| v.as_str()).unwrap_or("");
                let entry_rh = entry_obj
                    .get("render_hash")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                if page_rh != entry_rh {
                    "pending"
                } else {
                    "in-sync"
                }
            }
        } else {
            "unknown"
        };

        entry_obj.insert("drift".into(), Value::String(drift.into()));
        with_drift.insert(key, Value::Object(entry_obj));
    }

    Ok(Value::Object(with_drift))
}

pub fn build_sync(repo_path: &Path) -> Result<Value, CmdError> {
    read_json_file(&repo_path.join(".work").join("sync-state.json"))
}

pub fn build_git_log(repo_path: &Path, limit: Option<u32>) -> Result<Vec<GitCommit>, CmdError> {
    let limit = limit
        .filter(|&n| n > 0)
        .map(|n| n.min(500))
        .unwrap_or(20);
    let n_flag = format!("-n");
    let n_val = limit.to_string();
    let output = run(
        "git",
        &[
            "log",
            &n_flag,
            &n_val,
            "--pretty=format:%H%x1f%an%x1f%aI%x1f%s",
        ],
        repo_path,
    )
    .map_err(|e| CmdError::internal(format!("git log spawn failed: {e}")))?;

    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(CmdError::internal(format!("git log failed: {detail}")));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let commits = stdout
        .split('\n')
        .filter(|l| !l.is_empty())
        .map(|line| {
            let parts: Vec<&str> = line.split('\x1f').collect();
            GitCommit {
                hash: parts.first().unwrap_or(&"").to_string(),
                author: parts.get(1).unwrap_or(&"").to_string(),
                date: parts.get(2).unwrap_or(&"").to_string(),
                subject: parts.get(3).unwrap_or(&"").to_string(),
            }
        })
        .collect();
    Ok(commits)
}

pub fn build_releases(repo_path: &Path) -> Result<ReleasesResponse, CmdError> {
    let config = load_config(repo_path)?;
    let project = match config_str(&config, "ticketing", "project") {
        Some(p) if !p.is_empty() => p,
        _ => {
            return Ok(ReleasesResponse {
                offline: true,
                releases: json!([]),
            });
        }
    };

    // Prefer gh CLI (authenticated when available)
    if let Ok(output) = run("gh", &["api", &format!("repos/{project}/releases")], repo_path) {
        if output.status.success() {
            if let Ok(parsed) = serde_json::from_slice::<Value>(&output.stdout) {
                return Ok(ReleasesResponse {
                    offline: false,
                    releases: parsed,
                });
            }
            // fall through to REST fallback
        }
    }

    // Unauthenticated REST fallback via ureq
    let url = format!("https://api.github.com/repos/{project}/releases");
    match ureq::get(&url)
        .set("User-Agent", "wiki-ticket-ui")
        .set("Accept", "application/vnd.github+json")
        .call()
    {
        Ok(resp) if (200..300).contains(&resp.status()) => {
            if let Ok(parsed) = resp.into_json::<Value>() {
                return Ok(ReleasesResponse {
                    offline: false,
                    releases: parsed,
                });
            }
        }
        _ => {}
    }

    Ok(ReleasesResponse {
        offline: true,
        releases: json!([]),
    })
}

pub fn build_trace_check(repo_path: &Path) -> Result<TraceCheckResponse, CmdError> {
    let output = run("python3", &["bin/worklog", "trace-check"], repo_path)
        .map_err(|e| CmdError::internal(format!("trace-check spawn failed: {e}")))?;
    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    Ok(TraceCheckResponse {
        ok: output.status.success(),
        gaps: count_trace_check_gaps(&combined),
        output: combined,
    })
}

fn apply_repo_path(state: &State<'_, AppState>, path: PathBuf) -> Result<RepoInfo, CmdError> {
    // Validate before storing
    load_target_repo(&path)?;
    {
        let mut guard = state
            .repo
            .lock()
            .map_err(|_| CmdError::internal("repo state lock poisoned"))?;
        *guard = Some(path.clone());
    }
    build_repo_info(&path)
}

// ── Tauri command wrappers ──────────────────────────────────────────────────

#[tauri::command]
pub fn ping() -> Result<&'static str, CmdError> {
    Ok("pong")
}

#[tauri::command]
pub fn get_repo(state: State<'_, AppState>) -> Result<RepoInfo, CmdError> {
    let path = require_repo(&state)?;
    build_repo_info(&path)
}

#[tauri::command]
pub fn pick_repo(app: AppHandle, state: State<'_, AppState>) -> Result<RepoInfo, CmdError> {
    let folder = app
        .dialog()
        .file()
        .set_title("Choose a worklog repo")
        .blocking_pick_folder();

    let Some(file_path) = folder else {
        return Err(CmdError::bad_request("repo selection cancelled"));
    };

    let path = file_path
        .into_path()
        .map_err(|e| CmdError::bad_request(format!("invalid folder path: {e}")))?;

    apply_repo_path(&state, path)
}

#[tauri::command]
pub fn set_repo(state: State<'_, AppState>, path: String) -> Result<RepoInfo, CmdError> {
    let path = PathBuf::from(path);
    if !path.is_dir() {
        return Err(CmdError::bad_request(format!(
            "not a directory: {}",
            path.display()
        )));
    }
    apply_repo_path(&state, path)
}

#[tauri::command]
pub fn get_items(state: State<'_, AppState>) -> Result<Value, CmdError> {
    let path = require_repo(&state)?;
    build_items(&path)
}

#[tauri::command]
pub fn get_events(state: State<'_, AppState>) -> Result<Value, CmdError> {
    let path = require_repo(&state)?;
    build_events(&path)
}

#[tauri::command]
pub fn get_roadmap(state: State<'_, AppState>) -> Result<RoadmapResponse, CmdError> {
    let path = require_repo(&state)?;
    build_roadmap(&path)
}

#[tauri::command]
pub fn get_docs(state: State<'_, AppState>) -> Result<Value, CmdError> {
    let path = require_repo(&state)?;
    build_docs(&path)
}

#[tauri::command]
pub fn get_doc_content(state: State<'_, AppState>, path: String) -> Result<String, CmdError> {
    let repo = require_repo(&state)?;
    build_doc_content(&repo, &path)
}

#[tauri::command]
pub fn get_graph(state: State<'_, AppState>) -> Result<Value, CmdError> {
    let path = require_repo(&state)?;
    build_graph(&path)
}

#[tauri::command]
pub fn get_manifest(state: State<'_, AppState>) -> Result<Value, CmdError> {
    let path = require_repo(&state)?;
    build_manifest(&path)
}

#[tauri::command]
pub fn get_wiki_ledger(state: State<'_, AppState>) -> Result<Value, CmdError> {
    let path = require_repo(&state)?;
    build_wiki_ledger(&path)
}

#[tauri::command]
pub fn get_sync(state: State<'_, AppState>) -> Result<Value, CmdError> {
    let path = require_repo(&state)?;
    build_sync(&path)
}

#[tauri::command]
pub fn get_git_log(
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> Result<Vec<GitCommit>, CmdError> {
    let path = require_repo(&state)?;
    build_git_log(&path, limit)
}

#[tauri::command]
pub fn get_releases(state: State<'_, AppState>) -> Result<ReleasesResponse, CmdError> {
    let path = require_repo(&state)?;
    build_releases(&path)
}

#[tauri::command]
pub fn get_trace_check(state: State<'_, AppState>) -> Result<TraceCheckResponse, CmdError> {
    let path = require_repo(&state)?;
    build_trace_check(&path)
}
