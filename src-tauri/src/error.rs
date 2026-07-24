//! Command errors that preserve HTTP-like status codes for client ApiError parity.
use serde::Serialize;
use std::fmt;

#[derive(Debug, Serialize)]
pub struct CmdError {
    pub status: u16,
    pub message: String,
}

impl CmdError {
    pub fn new(status: u16, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(400, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(404, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(500, message)
    }
}

impl fmt::Display for CmdError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Serialize as JSON so invoke() reject payloads stay machine-readable
        // even when the runtime surfaces the error as a string.
        write!(
            f,
            "{{\"status\":{},\"message\":{}}}",
            self.status,
            serde_json::to_string(&self.message).unwrap_or_else(|_| "\"error\"".into())
        )
    }
}

impl std::error::Error for CmdError {}

impl From<crate::repo::TargetRepoError> for CmdError {
    fn from(err: crate::repo::TargetRepoError) -> Self {
        Self::new(err.status, err.message)
    }
}
