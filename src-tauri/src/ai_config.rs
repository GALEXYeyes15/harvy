//! Harvy AI model configuration — single source of truth (Rust/Tauri).
//!
//! Claude Sonnet 4.6 is the current default generation model.
//! Future model upgrades should only require changing `DEFAULT_MODEL` below.

/// Default generation model for all Tauri-native AI jobs.
pub const DEFAULT_MODEL: &str = "claude-sonnet-4-6";

pub const ANTHROPIC_MESSAGES_URL: &str = "https://api.anthropic.com/v1/messages";

pub const ANTHROPIC_API_VERSION: &str = "2023-06-01";

pub const DEFAULT_MAX_OUTPUT_TOKENS: u32 = 8192;

pub const ANTHROPIC_API_KEY_ENV: &str = "ANTHROPIC_API_KEY";
