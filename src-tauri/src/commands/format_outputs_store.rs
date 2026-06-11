use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use super::app_config_dir;
use super::format_generation::TwitterFormatCollection;

const FORMAT_OUTPUTS_DIR: &str = "format-outputs";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredDocumentFormatOutputs {
    document_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    essay_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    twitter: Option<TwitterFormatCollection>,
}

pub fn resolve_document_key(document_id: Option<&str>, essay_title: &str) -> String {
    if let Some(id) = document_id.map(str::trim).filter(|s| !s.is_empty()) {
        return sanitize_document_key(id);
    }
    let title = essay_title.trim();
    if !title.is_empty() {
        return sanitize_document_key(title);
    }
    "scratch".to_string()
}

fn sanitize_document_key(key: &str) -> String {
    let mut out = String::with_capacity(key.len());
    for ch in key.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == ':' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        "scratch".to_string()
    } else {
        out
    }
}

fn format_outputs_path(app: &AppHandle, document_key: &str) -> Result<PathBuf, String> {
    let dir = app_config_dir(app)?.join(FORMAT_OUTPUTS_DIR);
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Could not create format outputs directory '{}': {}", dir.display(), e))?;
    Ok(dir.join(format!("{}.json", sanitize_document_key(document_key))))
}

fn read_stored_outputs(app: &AppHandle, document_key: &str) -> Result<Option<StoredDocumentFormatOutputs>, String> {
    let path = format_outputs_path(app, document_key)?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path)
        .map_err(|e| format!("Could not read format outputs '{}': {}", path.display(), e))?;
    let stored: StoredDocumentFormatOutputs = serde_json::from_str(&text)
        .map_err(|e| format!("Could not parse format outputs '{}': {}", path.display(), e))?;
    Ok(Some(stored))
}

fn write_stored_outputs(app: &AppHandle, stored: &StoredDocumentFormatOutputs) -> Result<(), String> {
    let path = format_outputs_path(app, &stored.document_key)?;
    let json = serde_json::to_string_pretty(stored)
        .map_err(|e| format!("Could not serialize format outputs: {}", e))?;
    fs::write(&path, json)
        .map_err(|e| format!("Could not write format outputs '{}': {}", path.display(), e))
}

pub fn save_twitter_collection(
    app: &AppHandle,
    document_key: &str,
    essay_title: &str,
    collection: &TwitterFormatCollection,
) -> Result<(), String> {
    let key = sanitize_document_key(document_key);
    let mut stored = read_stored_outputs(app, &key)?.unwrap_or(StoredDocumentFormatOutputs {
        document_key: key.clone(),
        essay_title: None,
        twitter: None,
    });
    stored.document_key = key;
    stored.essay_title = Some(essay_title.trim().to_string());
    stored.twitter = Some(collection.clone());
    write_stored_outputs(app, &stored)
}

#[tauri::command]
pub fn load_twitter_formats(
    app: AppHandle,
    document_id: Option<String>,
    essay_title: String,
) -> Result<Option<TwitterFormatCollection>, String> {
    let document_key = resolve_document_key(document_id.as_deref(), &essay_title);
    let stored = read_stored_outputs(&app, &document_key)?;
    Ok(stored.and_then(|s| s.twitter))
}

#[tauri::command]
pub fn save_twitter_formats(
    app: AppHandle,
    document_id: Option<String>,
    essay_title: String,
    collection: TwitterFormatCollection,
) -> Result<(), String> {
    let document_key = resolve_document_key(document_id.as_deref(), &essay_title);
    save_twitter_collection(&app, &document_key, &essay_title, &collection)
}
