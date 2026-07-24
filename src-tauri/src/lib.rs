pub mod commands;
pub mod error;
pub mod repo;
mod state;
pub mod ulid;

use state::AppState;
use std::path::PathBuf;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Optional WORKLOG_REPO seed (mirrors Node env fallback). Never hardcode a path.
    let initial = std::env::var("WORKLOG_REPO")
        .ok()
        .map(PathBuf::from)
        .filter(|p| p.is_dir())
        .and_then(|p| repo::load_target_repo(&p).ok().map(|(path, _)| path));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new(initial))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::get_repo,
            commands::pick_repo,
            commands::set_repo,
            commands::get_items,
            commands::get_events,
            commands::get_roadmap,
            commands::get_docs,
            commands::get_doc_content,
            commands::get_graph,
            commands::get_manifest,
            commands::get_wiki_ledger,
            commands::get_sync,
            commands::get_git_log,
            commands::get_releases,
            commands::get_trace_check,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
