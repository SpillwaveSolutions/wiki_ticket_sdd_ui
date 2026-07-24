//! Target-repo resolution + a tiny hand-rolled parser for .work/config.yml
//! (flat two-level YAML — no dependency needed for that).
//! Port of server/src/repo.ts — deliberately not a full YAML crate.

use serde_json::{json, Map, Value};
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Debug)]
pub struct TargetRepoError {
    pub status: u16,
    pub message: String,
}

impl TargetRepoError {
    pub fn new(message: impl Into<String>, status: u16) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }
}

impl std::fmt::Display for TargetRepoError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for TargetRepoError {}

/// Strip a `#` comment that starts outside any quoted string.
fn strip_comment(line: &str) -> &str {
    let bytes = line.as_bytes();
    let mut quote: Option<u8> = None;
    for (i, &ch) in bytes.iter().enumerate() {
        if let Some(q) = quote {
            if ch == q {
                quote = None;
            }
        } else if ch == b'"' || ch == b'\'' {
            quote = Some(ch);
        } else if ch == b'#' {
            return &line[..i];
        }
    }
    line
}

fn unquote(v: &str) -> String {
    let b = v.as_bytes();
    if b.len() >= 2
        && ((b[0] == b'"' && b[b.len() - 1] == b'"') || (b[0] == b'\'' && b[b.len() - 1] == b'\''))
    {
        return v[1..v.len() - 1].to_string();
    }
    v.to_string()
}

/// Parses a flat, two-level-deep YAML subset: top-level `key:` sections
/// containing indented `subkey: value` scalars, plus top-level `key: value`
/// scalars. Anything deeper (lists, block scalars) is ignored — config.yml
/// never needs it for the fields this server reads.
pub fn parse_flat_yaml(text: &str) -> Map<String, Value> {
    let mut result: Map<String, Value> = Map::new();
    let mut section: Option<String> = None;

    for raw_line in text.split('\n') {
        if raw_line.trim().is_empty() || raw_line.trim_start().starts_with('#') {
            continue;
        }
        let line = strip_comment(raw_line);
        if line.trim().is_empty() {
            continue;
        }
        let indent = line.len() - line.trim_start().len();
        let trimmed = line.trim();
        let Some(colon_idx) = trimmed.find(':') else {
            continue;
        };
        let key = trimmed[..colon_idx].trim().to_string();
        let value = trimmed[colon_idx + 1..].trim();

        if indent == 0 {
            if value.is_empty() {
                section = Some(key.clone());
                result.insert(key, json!({}));
            } else {
                section = None;
                result.insert(key, Value::String(unquote(value)));
            }
        } else if let Some(ref sec) = section {
            if value.is_empty() {
                continue; // deeper nesting / lists — not needed here
            }
            let entry = result.entry(sec.clone()).or_insert_with(|| json!({}));
            if !entry.is_object() {
                *entry = json!({});
            }
            if let Some(obj) = entry.as_object_mut() {
                obj.insert(key, Value::String(unquote(value)));
            }
        }
    }
    result
}

/// A valid target has `.work/config.yml` at its root. Throws otherwise.
pub fn load_target_repo(repo_path: &Path) -> Result<(PathBuf, Map<String, Value>), TargetRepoError> {
    let config_path = repo_path.join(".work").join("config.yml");
    if !config_path.exists() {
        return Err(TargetRepoError::new(
            format!(
                "Not a worklog repo: {} (missing .work/config.yml)",
                repo_path.display()
            ),
            400,
        ));
    }
    let raw = fs::read_to_string(&config_path).map_err(|e| {
        TargetRepoError::new(format!("failed to read config.yml: {e}"), 400)
    })?;
    let config = parse_flat_yaml(&raw);
    Ok((repo_path.to_path_buf(), config))
}

/// Collapse `.` / `..` components without requiring the path to exist on disk.
fn normalize_path(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for c in path.components() {
        match c {
            Component::Prefix(p) => out.push(p.as_os_str()),
            Component::RootDir => out.push(c.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            Component::Normal(s) => out.push(s),
        }
    }
    out
}

/// Resolves a doc path (as it appears in the inventory, e.g. "docs/adr/x.md")
/// against the repo root and refuses anything that escapes the repo's docs/ dir.
pub fn resolve_doc_path(repo_path: &Path, requested: &str) -> Result<PathBuf, TargetRepoError> {
    let docs_root = normalize_path(&repo_path.join("docs"));
    let resolved = normalize_path(&repo_path.join(requested));

    // Mirror Node: docsRoot has a trailing separator, so startsWith requires
    // the path to be strictly under docs/, not equal to docs itself.
    let docs_prefix = {
        let mut s = docs_root.into_os_string();
        s.push(std::path::MAIN_SEPARATOR_STR);
        PathBuf::from(s)
    };
    let resolved_str = resolved.as_os_str();
    let prefix_str = docs_prefix.as_os_str();
    let under = resolved_str
        .as_encoded_bytes()
        .starts_with(prefix_str.as_encoded_bytes());

    if !under {
        return Err(TargetRepoError::new(
            format!("Path escapes docs/: {requested}"),
            400,
        ));
    }
    Ok(resolved)
}

/// Helper: nested config string lookup, e.g. config["project"]["name"].
pub fn config_str(config: &Map<String, Value>, section: &str, key: &str) -> Option<String> {
    config
        .get(section)?
        .as_object()?
        .get(key)?
        .as_str()
        .map(|s| s.to_string())
}

pub fn config_top_str(config: &Map<String, Value>, key: &str) -> Option<String> {
    config.get(key)?.as_str().map(|s| s.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    const FIXTURE_CONFIG: &str = r#"# fixture config
version: 1

project:
  key: FIX
  name: "Fixture Project"

ticketing:
  system: github               # inline comment should be stripped
  project: acme/fixture-repo

wiki:
  system: github-wiki
  root_url: https://github.com/acme/fixture-repo/wiki

paths:
  plans: docs/plans
  status: docs/status
  roadmap: docs/roadmap.md
installed: 0.1.0
"#;

    #[test]
    fn parse_fixture_config() {
        let config = parse_flat_yaml(FIXTURE_CONFIG);
        assert_eq!(config_str(&config, "project", "key").as_deref(), Some("FIX"));
        assert_eq!(
            config_str(&config, "project", "name").as_deref(),
            Some("Fixture Project")
        );
        assert_eq!(
            config_str(&config, "ticketing", "project").as_deref(),
            Some("acme/fixture-repo")
        );
        assert_eq!(
            config_str(&config, "wiki", "root_url").as_deref(),
            Some("https://github.com/acme/fixture-repo/wiki")
        );
        assert_eq!(
            config_str(&config, "paths", "roadmap").as_deref(),
            Some("docs/roadmap.md")
        );
        assert_eq!(config_top_str(&config, "installed").as_deref(), Some("0.1.0"));
    }

    #[test]
    fn strips_inline_comments_without_corrupting_quoted_values() {
        let config = parse_flat_yaml("project:\n  name: \"Has # not a comment\"\n");
        assert_eq!(
            config_str(&config, "project", "name").as_deref(),
            Some("Has # not a comment")
        );
    }

    #[test]
    fn load_target_repo_rejects_missing_config() {
        let dir = std::env::temp_dir().join(format!("wt-not-a-repo-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let err = load_target_repo(&dir).unwrap_err();
        assert_eq!(err.status, 400);
        assert!(err.message.contains(".work/config.yml"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn load_target_repo_ok() {
        let dir = std::env::temp_dir().join(format!("wt-repo-ok-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(dir.join(".work")).unwrap();
        let mut f = fs::File::create(dir.join(".work/config.yml")).unwrap();
        f.write_all(FIXTURE_CONFIG.as_bytes()).unwrap();
        let (path, config) = load_target_repo(&dir).unwrap();
        assert_eq!(path, dir);
        assert_eq!(config_str(&config, "project", "key").as_deref(), Some("FIX"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_doc_path_blocks_traversal() {
        let repo = PathBuf::from("/tmp/some-repo");
        let err = resolve_doc_path(&repo, "docs/../.work/config.yml").unwrap_err();
        assert_eq!(err.status, 400);
        assert!(err.message.contains("escapes docs"));
    }

    #[test]
    fn resolve_doc_path_allows_docs_file() {
        let repo = PathBuf::from("/tmp/some-repo");
        let p = resolve_doc_path(&repo, "docs/adr/0001-test.md").unwrap();
        assert!(p.ends_with("docs/adr/0001-test.md"));
    }
}
