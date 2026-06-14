use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use super::app_config_dir;
use super::format_generation::FormatCollection;

const FORMAT_OUTPUTS_DIR: &str = "format-outputs";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LegacyTwitterFormatItem {
    id: String,
    text: String,
    status: String,
    favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LegacyTwitterFormatCollection {
    platform: String,
    #[serde(rename = "type")]
    collection_type: String,
    title: String,
    items: Vec<LegacyTwitterFormatItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoredDocumentFormatOutputs {
    document_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    essay_title: Option<String>,
    #[serde(default)]
    collections: HashMap<String, FormatCollection>,
    #[serde(skip_serializing_if = "Option::is_none")]
    twitter: Option<LegacyTwitterFormatCollection>,
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

fn migrate_legacy_twitter(stored: &mut StoredDocumentFormatOutputs) {
    if stored.collections.contains_key("tweets_notes") {
        return;
    }
    let Some(legacy) = stored.twitter.clone() else {
        return;
    };
    let items = legacy
        .items
        .into_iter()
        .map(|item| super::format_generation::FormatOutputItem {
            id: item.id,
            title: None,
            content: item.text,
            status: item.status,
            favorite: item.favorite,
        })
        .collect();
    stored.collections.insert(
        "tweets_notes".to_string(),
        FormatCollection::new("tweets_notes", legacy.title, items),
    );
}

fn read_stored_outputs(app: &AppHandle, document_key: &str) -> Result<Option<StoredDocumentFormatOutputs>, String> {
    let path = format_outputs_path(app, document_key)?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path)
        .map_err(|e| format!("Could not read format outputs '{}': {}", path.display(), e))?;
    let mut stored: StoredDocumentFormatOutputs = serde_json::from_str(&text)
        .map_err(|e| format!("Could not parse format outputs '{}': {}", path.display(), e))?;
    migrate_legacy_twitter(&mut stored);
    Ok(Some(stored))
}

fn write_stored_outputs(app: &AppHandle, stored: &StoredDocumentFormatOutputs) -> Result<(), String> {
    let path = format_outputs_path(app, &stored.document_key)?;
    let json = serde_json::to_string_pretty(stored)
        .map_err(|e| format!("Could not serialize format outputs: {}", e))?;
    fs::write(&path, json)
        .map_err(|e| format!("Could not write format outputs '{}': {}", path.display(), e))
}

pub fn save_format_collection(
    app: &AppHandle,
    document_key: &str,
    essay_title: &str,
    category: &str,
    collection: &FormatCollection,
) -> Result<(), String> {
    let key = sanitize_document_key(document_key);
    let mut stored = read_stored_outputs(app, &key)?.unwrap_or(StoredDocumentFormatOutputs {
        document_key: key.clone(),
        essay_title: None,
        collections: HashMap::new(),
        twitter: None,
    });
    stored.document_key = key;
    stored.essay_title = Some(essay_title.trim().to_string());
    stored.collections.insert(category.to_string(), collection.clone());
    write_stored_outputs(app, &stored)
}

pub fn save_twitter_collection(
    app: &AppHandle,
    document_key: &str,
    essay_title: &str,
    collection: &FormatCollection,
) -> Result<(), String> {
    save_format_collection(app, document_key, essay_title, "tweets_notes", collection)
}

#[tauri::command]
pub fn load_format_collection(
    app: AppHandle,
    category: String,
    document_id: Option<String>,
    essay_title: String,
) -> Result<Option<FormatCollection>, String> {
    let document_key = resolve_document_key(document_id.as_deref(), &essay_title);
    let stored = read_stored_outputs(&app, &document_key)?;
    Ok(stored.and_then(|s| s.collections.get(&category).cloned()))
}

#[tauri::command]
pub fn save_format_collection_command(
    app: AppHandle,
    category: String,
    document_id: Option<String>,
    essay_title: String,
    collection: FormatCollection,
) -> Result<(), String> {
    let document_key = resolve_document_key(document_id.as_deref(), &essay_title);
    save_format_collection(&app, &document_key, &essay_title, &category, &collection)
}

#[tauri::command]
pub fn load_twitter_formats(
    app: AppHandle,
    document_id: Option<String>,
    essay_title: String,
) -> Result<Option<FormatCollection>, String> {
    load_format_collection(app, "tweets_notes".to_string(), document_id, essay_title)
}

#[tauri::command]
pub fn save_twitter_formats(
    app: AppHandle,
    document_id: Option<String>,
    essay_title: String,
    collection: FormatCollection,
) -> Result<(), String> {
    save_format_collection_command(
        app,
        "tweets_notes".to_string(),
        document_id,
        essay_title,
        collection,
    )
}
