//! Shared app state: currently selected target worklog repo.
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppState {
    /// Empty until the user picks a repo (or WORKLOG_REPO seeds it at startup).
    pub repo: Mutex<Option<PathBuf>>,
}

impl AppState {
    pub fn new(initial: Option<PathBuf>) -> Self {
        Self {
            repo: Mutex::new(initial),
        }
    }
}
