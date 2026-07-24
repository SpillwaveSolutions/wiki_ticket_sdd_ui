//! Parity checks against the Node fixture (server/test/fixture.ts).
//! Spawns `npx tsx server/test/build-fixture.ts` for a fresh path, then calls
//! the pure command builders directly.

use app_lib::commands::{
    build_doc_content, build_docs, build_events, build_graph, build_items, build_manifest,
    build_repo_info, build_roadmap, build_trace_check, build_wiki_ledger,
};
use app_lib::repo::{load_target_repo, resolve_doc_path};
use std::path::{Path, PathBuf};
use std::process::Command;

fn repo_root() -> PathBuf {
    // src-tauri/tests/parity.rs → workspace root is ../..
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("src-tauri parent")
        .to_path_buf()
}

fn fresh_fixture() -> PathBuf {
    let root = repo_root();
    let output = Command::new("npx")
        .args(["tsx", "server/test/build-fixture.ts"])
        .current_dir(&root)
        .output()
        .expect("spawn npx tsx server/test/build-fixture.ts");
    assert!(
        output.status.success(),
        "build-fixture failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    assert!(!path.is_empty(), "build-fixture printed empty path");
    PathBuf::from(path)
}

#[test]
fn fixture_repo_loads() {
    let dir = fresh_fixture();
    let (path, config) = load_target_repo(&dir).expect("load fixture");
    assert_eq!(path, dir);
    assert_eq!(
        config
            .get("project")
            .and_then(|p| p.get("key"))
            .and_then(|k| k.as_str()),
        Some("FIX")
    );
}

#[test]
fn items_match_fixture_fold() {
    let dir = fresh_fixture();
    let items = build_items(&dir).expect("items");
    let arr = items.as_array().expect("array");
    assert_eq!(arr.len(), 2);
    assert_eq!(arr[0]["title"], "First item");
    assert_eq!(arr[0]["status"], "done");
    assert_eq!(arr[1]["title"], "No explicit ts");
}

#[test]
fn events_derive_ts_and_sort_desc() {
    let dir = fresh_fixture();
    let events = build_events(&dir).expect("events");
    let arr = events.as_array().expect("array");
    assert_eq!(arr.len(), 3);

    // Newest first: 2026-01-05 snapshot, then 2026-01-01 create, then ULID-derived
    // Actually fixture: todo has ts 2026-01-01 and no-ts (ULID 01KXS7...), done has 2026-01-05
    // ULID 01KXS7 is ~2026-ish (newer than 2016). Sort by ts desc.
    let ts: Vec<&str> = arr
        .iter()
        .map(|e| e.get("ts").and_then(|t| t.as_str()).unwrap_or(""))
        .collect();
    assert!(ts.iter().all(|t| !t.is_empty()), "all events have ts: {ts:?}");
    for w in ts.windows(2) {
        assert!(w[0] >= w[1], "not sorted desc: {ts:?}");
    }

    // The event without explicit ts got a derived one matching its ULID
    let derived = arr
        .iter()
        .find(|e| e.get("ev").and_then(|v| v.as_str()) == Some("01KXS7W15S2NQ0VJT9TDR7B7CX"))
        .expect("derived event");
    assert!(derived.get("ts").and_then(|t| t.as_str()).is_some());
}

#[test]
fn roadmap_parses_frontmatter() {
    let dir = fresh_fixture();
    let r = build_roadmap(&dir).expect("roadmap");
    assert!(r.markdown.contains("Fixture roadmap body"));
    assert_eq!(
        r.meta.get("wiki_key").and_then(|v| v.as_str()),
        Some("roadmap")
    );
}

#[test]
fn docs_graph_manifest_passthrough() {
    let dir = fresh_fixture();
    let docs = build_docs(&dir).expect("docs");
    assert_eq!(docs["docs"][0]["wiki_key"], "adr/0001-test");

    let graph = build_graph(&dir).expect("graph");
    assert_eq!(graph["edges"].as_array().unwrap().len(), 1);

    let manifest = build_manifest(&dir).expect("manifest");
    assert_eq!(manifest["pages"].as_array().unwrap().len(), 3);
}

#[test]
fn doc_content_and_traversal_guard() {
    let dir = fresh_fixture();
    let body = build_doc_content(&dir, "docs/adr/0001-test.md").expect("content");
    assert!(body.contains("Frozen content."));

    let err = build_doc_content(&dir, "docs/../.work/config.yml").unwrap_err();
    assert_eq!(err.status, 400);
    assert!(err.message.contains("escapes docs"));

    let err2 = resolve_doc_path(&dir, "/etc/passwd").unwrap_err();
    assert_eq!(err2.status, 400);
}

#[test]
fn wiki_ledger_three_drift_states() {
    let dir = fresh_fixture();
    let ledger = build_wiki_ledger(&dir).expect("ledger");
    assert_eq!(ledger["adr/0001-test"]["drift"], "in-sync");
    assert_eq!(ledger["roadmap"]["drift"], "pending");
    assert_eq!(ledger["guide/pending-doc"]["drift"], "source-drift");
    assert_eq!(
        ledger["adr/0001-test"]["url"],
        "https://github.com/acme/fixture-repo/wiki/ADR-0001-test"
    );
}

#[test]
fn trace_check_counts_gaps() {
    let dir = fresh_fixture();
    let t = build_trace_check(&dir).expect("trace");
    assert!(!t.ok);
    assert!(t.output.contains("no external ticket"));
    assert_eq!(t.gaps, 1);
}

#[test]
fn repo_info_version_no_skew() {
    let dir = fresh_fixture();
    let info = build_repo_info(&dir).expect("repo");
    assert_eq!(info.key.as_deref(), Some("FIX"));
    assert_eq!(info.name.as_deref(), Some("Fixture Project"));
    assert_eq!(info.worklog_version.as_deref(), Some("0.1.0"));
    assert_eq!(info.installed_version.as_deref(), Some("0.1.0"));
    assert!(!info.drift.version_skew);
    assert_eq!(info.github_project.as_deref(), Some("acme/fixture-repo"));
}

/// Optional dogfood smoke: set DOGFOOD_REPO to a real worklog path (e.g.
/// ../wiki_ticket_sdd) to exercise against production data. Skipped otherwise.
#[test]
fn dogfood_repo_if_configured() {
    let Some(raw) = std::env::var_os("DOGFOOD_REPO") else {
        return;
    };
    let dir = PathBuf::from(raw);
    if !dir.join(".work").join("config.yml").exists() {
        return;
    }
    let info = build_repo_info(&dir).expect("dogfood repo info");
    assert!(!info.repo_path.is_empty());
    let items = build_items(&dir).expect("dogfood items");
    assert!(items.as_array().is_some());
    // Traversal guard still holds on real repos
    let err = build_doc_content(&dir, "docs/../.work/config.yml").unwrap_err();
    assert_eq!(err.status, 400);
}

#[allow(dead_code)]
fn _assert_path_is_path(p: &Path) {
    let _ = p;
}
