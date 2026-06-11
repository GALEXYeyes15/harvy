mod openai;
mod types;

pub use types::TwitterFormatCollection;

use tauri::AppHandle;

use crate::commands::format_outputs_store;

// TODO(format): add generate_youtube_formats, generate_linkedin_formats, etc.

#[tauri::command]
pub fn generate_twitter_formats(
    app: AppHandle,
    essay_title: String,
    essay_text: String,
    target_count: i64,
    document_id: Option<String>,
    inspiration_examples: Option<Vec<types::FormatInspirationExample>>,
) -> Result<TwitterFormatCollection, String> {
    let trimmed = essay_text.trim();
    if trimmed.is_empty() {
        return Err("Essay text is empty".to_string());
    }
    if target_count <= 0 {
        return Err("Invalid target count".to_string());
    }

    let examples = inspiration_examples.unwrap_or_default();
    let collection = openai::generate_twitter_collection(trimmed, target_count, &examples)?;
    let document_key = format_outputs_store::resolve_document_key(document_id.as_deref(), &essay_title);
    format_outputs_store::save_twitter_collection(&app, &document_key, &essay_title, &collection)?;
    Ok(collection)
}
