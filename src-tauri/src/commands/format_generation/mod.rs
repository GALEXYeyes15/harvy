mod openai;
mod orchestrator;
mod prompts;
mod types;

pub use types::{FormatCollection, FormatOutputItem};

use tauri::AppHandle;

use crate::commands::format_outputs_store;

#[tauri::command]
pub fn generate_format_outputs(
    app: AppHandle,
    request: types::FormatGenerationRequest,
) -> Result<types::FormatGenerationOrchestratorResult, String> {
    orchestrator::generate_format_outputs(&app, request)
}

#[tauri::command]
pub fn generate_tweets_notes_formats(
    app: AppHandle,
    essay_title: String,
    essay_text: String,
    target_count: i64,
    document_id: Option<String>,
    inspiration_examples: Option<Vec<types::FormatInspirationExample>>,
) -> Result<FormatCollection, String> {
    let trimmed = essay_text.trim();
    if trimmed.is_empty() {
        return Err("Essay text is empty".to_string());
    }
    if target_count <= 0 {
        return Err("Invalid target count".to_string());
    }

    let examples = inspiration_examples.unwrap_or_default();
    let collection = openai::generate_tweets_notes_collection(trimmed, target_count, &examples)?;
    let document_key = format_outputs_store::resolve_document_key(document_id.as_deref(), &essay_title);
    format_outputs_store::save_format_collection(
        &app,
        &document_key,
        &essay_title,
        "tweets_notes",
        &collection,
    )?;
    Ok(collection)
}

/// @deprecated Use generate_tweets_notes_formats
#[tauri::command]
pub fn generate_twitter_formats(
    app: AppHandle,
    essay_title: String,
    essay_text: String,
    target_count: i64,
    document_id: Option<String>,
    inspiration_examples: Option<Vec<types::FormatInspirationExample>>,
) -> Result<FormatCollection, String> {
    generate_tweets_notes_formats(
        app,
        essay_title,
        essay_text,
        target_count,
        document_id,
        inspiration_examples,
    )
}

// TODO(format): generate_short_form_outline_formats
#[tauri::command]
pub fn generate_short_form_outline_formats(
    _app: AppHandle,
    _essay_title: String,
    _essay_text: String,
    _target_count: i64,
    _document_id: Option<String>,
    _inspiration_examples: Option<Vec<types::FormatInspirationExample>>,
) -> Result<FormatCollection, String> {
    Err("Short Form Outline generation is not yet implemented".to_string())
}

// TODO(format): generate_long_form_outline_formats
#[tauri::command]
pub fn generate_long_form_outline_formats(
    _app: AppHandle,
    _essay_title: String,
    _essay_text: String,
    _target_count: i64,
    _document_id: Option<String>,
    _inspiration_examples: Option<Vec<types::FormatInspirationExample>>,
) -> Result<FormatCollection, String> {
    Err("Long Form Outline generation is not yet implemented".to_string())
}

// TODO(format): generate_newsletter_formats
#[tauri::command]
pub fn generate_newsletter_formats(
    _app: AppHandle,
    _essay_title: String,
    _essay_text: String,
    _target_count: i64,
    _document_id: Option<String>,
    _inspiration_examples: Option<Vec<types::FormatInspirationExample>>,
) -> Result<FormatCollection, String> {
    Err("Newsletter generation is not yet implemented".to_string())
}

// TODO(format): generate_podcast_notes_formats
#[tauri::command]
pub fn generate_podcast_notes_formats(
    _app: AppHandle,
    _essay_title: String,
    _essay_text: String,
    _target_count: i64,
    _document_id: Option<String>,
    _inspiration_examples: Option<Vec<types::FormatInspirationExample>>,
) -> Result<FormatCollection, String> {
    Err("Podcast Notes generation is not yet implemented".to_string())
}
