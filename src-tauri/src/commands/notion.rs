//! Notion Ideas sync — integration token + database query/update.
//! Config lives in the app config dir (not Vite env).

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::thread;
use std::time::Duration;
use tauri::AppHandle;

use super::app_config_dir;

mod markdown;
use markdown::markdown_to_notion_blocks;

const NOTION_API_BASE: &str = "https://api.notion.com/v1";
const NOTION_VERSION: &str = "2022-06-28";
const CONFIG_FILE_NAME: &str = "notion-ideas.json";
const DEFAULT_IDEA_STATUS: &str = "Idea";
const DEFAULT_STARTED_STATUS: &str = "Started";
const DEFAULT_PUBLISHED_STATUS: &str = "Published";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionIdeasConfig {
    pub token: String,
    pub database_id: String,
    pub title_property: String,
    pub notes_property: String,
    pub status_property: String,
    /// Status value that means “in the Ideas queue” (shown in Harvy).
    #[serde(default = "default_idea_status")]
    pub idea_status_value: String,
    /// Status value set when Start writing (removed from Ideas).
    #[serde(default = "default_started_status")]
    pub started_status_value: String,
    /// Status value set by Copy, Sync, + Publish.
    #[serde(default = "default_published_status")]
    pub published_status_value: String,
    /// Optional URL property on the Ideas database for the published essay link.
    #[serde(default)]
    pub url_property: String,
    /// Optional date property stamped when publishing.
    #[serde(default)]
    pub date_property: String,
}

fn default_idea_status() -> String {
    DEFAULT_IDEA_STATUS.to_string()
}

fn default_started_status() -> String {
    DEFAULT_STARTED_STATUS.to_string()
}

fn default_published_status() -> String {
    DEFAULT_PUBLISHED_STATUS.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionIdeasConfigPublic {
    pub connected: bool,
    pub database_id: String,
    pub title_property: String,
    pub notes_property: String,
    pub status_property: String,
    pub idea_status_value: String,
    pub started_status_value: String,
    pub published_status_value: String,
    pub url_property: String,
    pub date_property: String,
    /// Whether a token is stored (never returns the secret).
    pub has_token: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionPropertyInfo {
    pub name: String,
    /// Notion property type: title, rich_text, status, select, etc.
    pub property_type: String,
    /// Select / status option names (empty for other types).
    #[serde(default)]
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionIdeaPage {
    pub page_id: String,
    pub title: String,
    pub notes: String,
    pub status: String,
    pub created_time: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionSyncEssayInput {
    pub title: String,
    pub markdown: String,
    pub parent_page_id: Option<String>,
    pub essay_page_id: Option<String>,
    #[serde(default)]
    pub rename_parent: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionSyncEssayResult {
    pub parent_page_id: String,
    pub essay_page_id: String,
    pub rename_parent: bool,
    pub parent_url: String,
    pub essay_url: String,
}

fn config_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app_config_dir(app)?.join(CONFIG_FILE_NAME))
}

fn read_config(app: &AppHandle) -> Result<Option<NotionIdeasConfig>, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path)
        .map_err(|e| format!("Could not read Notion config '{}': {}", path.display(), e))?;
    let parsed: NotionIdeasConfig = serde_json::from_str(&text)
        .map_err(|e| format!("Could not parse Notion config: {}", e))?;
    Ok(Some(parsed))
}

fn write_config(app: &AppHandle, config: &NotionIdeasConfig) -> Result<(), String> {
    let path = config_path(app)?;
    let text = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Could not serialize Notion config: {}", e))?;
    fs::write(&path, text)
        .map_err(|e| format!("Could not save Notion config '{}': {}", path.display(), e))?;
    Ok(())
}

fn notion_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|e| format!("Could not build HTTP client: {}", e))
}

fn notion_headers(token: &str) -> Result<reqwest::header::HeaderMap, String> {
    let mut headers = reqwest::header::HeaderMap::new();
    let auth = format!("Bearer {}", token.trim());
    headers.insert(
        reqwest::header::AUTHORIZATION,
        auth.parse()
            .map_err(|_| "Invalid Notion integration token.".to_string())?,
    );
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/json"),
    );
    headers.insert(
        "Notion-Version",
        reqwest::header::HeaderValue::from_static(NOTION_VERSION),
    );
    Ok(headers)
}

/// Extract a 32-char Notion UUID (with or without dashes) from a URL or raw id.
pub fn normalize_notion_database_id(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Enter a Notion database URL or ID.".to_string());
    }

    // Explicit dashed UUID anywhere in the string.
    let chars: Vec<char> = trimmed.chars().collect();
    if chars.len() >= 36 {
        for i in 0..=chars.len().saturating_sub(36) {
            let slice: String = chars[i..i + 36].iter().collect();
            if is_dashed_notion_uuid(&slice) {
                return Ok(slice.to_lowercase());
            }
        }
    }

    // Contiguous 32 hex digits (common in Notion share URLs).
    let mut run = String::new();
    for ch in trimmed.chars() {
        if ch.is_ascii_hexdigit() {
            run.push(ch);
            if run.len() == 32 {
                return Ok(format_notion_uuid(&run));
            }
        } else {
            run.clear();
        }
    }

    Err("Could not parse a Notion database ID from that URL.".to_string())
}

fn is_dashed_notion_uuid(value: &str) -> bool {
    let b = value.as_bytes();
    if b.len() != 36 {
        return false;
    }
    for (i, byte) in b.iter().enumerate() {
        let ok = match i {
            8 | 13 | 18 | 23 => *byte == b'-',
            _ => byte.is_ascii_hexdigit(),
        };
        if !ok {
            return false;
        }
    }
    true
}

fn format_notion_uuid(hex32: &str) -> String {
    let h = hex32.to_lowercase();
    format!(
        "{}-{}-{}-{}-{}",
        &h[0..8],
        &h[8..12],
        &h[12..16],
        &h[16..20],
        &h[20..32]
    )
}

/// Strict page/block id: the whole string must be a Notion UUID, not a title or file path.
fn parse_stored_notion_id(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if is_dashed_notion_uuid(trimmed) {
        return Some(trimmed.to_lowercase());
    }
    let mut hex = String::new();
    for ch in trimmed.chars() {
        if ch == '-' {
            continue;
        }
        if !ch.is_ascii_hexdigit() {
            return None;
        }
        hex.push(ch.to_ascii_lowercase());
    }
    if hex.len() == 32 {
        Some(format_notion_uuid(&hex))
    } else {
        None
    }
}

fn rich_text_plain(value: &Value) -> String {
    let Some(arr) = value.as_array() else {
        return String::new();
    };
    arr.iter()
        .filter_map(|item| {
            item.get("plain_text")
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .collect::<Vec<_>>()
        .join("")
}

fn property_plain_text(prop: &Value) -> String {
    let prop_type = prop.get("type").and_then(|v| v.as_str()).unwrap_or("");
    match prop_type {
        "title" => rich_text_plain(prop.get("title").unwrap_or(&Value::Null)),
        "rich_text" => rich_text_plain(prop.get("rich_text").unwrap_or(&Value::Null)),
        "text" => rich_text_plain(prop.get("text").unwrap_or(&Value::Null)),
        "status" => prop
            .get("status")
            .and_then(|s| s.get("name"))
            .and_then(|n| n.as_str())
            .unwrap_or("")
            .to_string(),
        "select" => prop
            .get("select")
            .and_then(|s| s.get("name"))
            .and_then(|n| n.as_str())
            .unwrap_or("")
            .to_string(),
        _ => String::new(),
    }
}

fn block_to_plain_line(block: &Value) -> Option<String> {
    let ty = block.get("type")?.as_str()?;
    let payload = block.get(ty)?;
    let text = rich_text_plain(payload.get("rich_text").unwrap_or(&Value::Null));
    let trimmed = text.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn blocks_to_plain_text(blocks: &[Value]) -> String {
    blocks
        .iter()
        .filter_map(block_to_plain_line)
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn format_named_text(name: &str, value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed
        .to_ascii_lowercase()
        .starts_with(&name.trim().to_ascii_lowercase())
    {
        trimmed.to_string()
    } else {
        format!("{name}: {trimmed}")
    }
}

fn push_rich_text_property(
    name: &str,
    prop: &Value,
    parts: &mut Vec<String>,
    seen: &mut std::collections::HashSet<String>,
) {
    let key = name.to_ascii_lowercase();
    if seen.contains(&key) {
        return;
    }
    let prop_type = prop.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if !matches!(prop_type, "rich_text" | "text") {
        return;
    }
    let text = property_plain_text(prop);
    if text.trim().is_empty() {
        return;
    }
    seen.insert(key);
    parts.push(format_named_text(name, &text));
}

fn idea_property_notes(properties: &Value, config: &NotionIdeasConfig) -> String {
    let Some(obj) = properties.as_object() else {
        return String::new();
    };
    let mut parts: Vec<String> = Vec::new();
    let mut seen = std::collections::HashSet::<String>::new();

    if !config.notes_property.trim().is_empty() {
        if let Some(prop) = obj.get(&config.notes_property) {
            push_rich_text_property(&config.notes_property, prop, &mut parts, &mut seen);
        }
    }

    for (name, prop) in obj {
        if name.eq_ignore_ascii_case(&config.title_property)
            || name.eq_ignore_ascii_case(&config.status_property)
        {
            continue;
        }
        push_rich_text_property(name, prop, &mut parts, &mut seen);
    }

    parts.join("\n\n")
}

fn merge_idea_notes(property_notes: &str, page_body: &str) -> String {
    let property_notes = property_notes.trim();
    let page_body = page_body.trim();
    if property_notes.is_empty() {
        return page_body.to_string();
    }
    if page_body.is_empty() || property_notes.contains(page_body) {
        return property_notes.to_string();
    }
    if page_body.contains(property_notes) {
        return page_body.to_string();
    }
    format!("{property_notes}\n\n{page_body}")
}

fn fetch_block_children(
    client: &Client,
    token: &str,
    block_id: &str,
) -> Result<Vec<Value>, String> {
    let mut blocks: Vec<Value> = Vec::new();
    let mut start_cursor: Option<String> = None;
    loop {
        let url = format!("{}/blocks/{}/children", NOTION_API_BASE, block_id);
        let mut request = client
            .get(&url)
            .headers(notion_headers(token)?)
            .query(&[("page_size", "100")]);
        if let Some(cursor) = &start_cursor {
            request = request.query(&[("start_cursor", cursor.as_str())]);
        }
        let response = request
            .send()
            .map_err(|e| format!("Notion page request failed: {}", e))?;
        let status = response.status();
        let text = response
            .text()
            .map_err(|e| format!("Could not read Notion page: {}", e))?;
        if !status.is_success() {
            return Err(parse_error_body(&text));
        }
        let parsed: Value =
            serde_json::from_str(&text).map_err(|e| format!("Invalid Notion page JSON: {}", e))?;
        if let Some(results) = parsed.get("results").and_then(|r| r.as_array()) {
            blocks.extend(results.iter().cloned());
        }
        let has_more = parsed
            .get("has_more")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if !has_more {
            break;
        }
        start_cursor = parsed
            .get("next_cursor")
            .and_then(|c| c.as_str())
            .map(str::to_string);
        if start_cursor.is_none() {
            break;
        }
    }
    Ok(blocks)
}

fn should_fetch_nested_blocks(block: &Value) -> bool {
    let ty = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
    if matches!(ty, "child_page" | "child_database") {
        return false;
    }
    block
        .get("has_children")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

fn collect_blocks_plain(
    client: &Client,
    token: &str,
    blocks: &[Value],
    depth: u32,
) -> Result<String, String> {
    const MAX_DEPTH: u32 = 4;
    let mut lines: Vec<String> = Vec::new();
    for block in blocks {
        if let Some(line) = block_to_plain_line(block) {
            lines.push(line);
        }
        if depth < MAX_DEPTH && should_fetch_nested_blocks(block) {
            if let Some(id) = block.get("id").and_then(|v| v.as_str()) {
                let children = fetch_block_children(client, token, id)?;
                let nested = collect_blocks_plain(client, token, &children, depth + 1)?;
                if !nested.trim().is_empty() {
                    lines.push(nested);
                }
            }
        }
    }
    Ok(lines.join("\n\n"))
}

fn fetch_page_body_plain(client: &Client, token: &str, page_id: &str) -> Result<String, String> {
    let blocks = fetch_block_children(client, token, page_id)?;
    collect_blocks_plain(client, token, &blocks, 0)
}

fn fill_page_bodies(client: &Client, token: &str, pages: &mut [NotionIdeaPage]) {
    for page in pages.iter_mut() {
        match fetch_page_body_plain(client, token, &page.page_id) {
            Ok(body) => page.notes = merge_idea_notes(&page.notes, &body),
            Err(e) => eprintln!(
                "[harvy] Could not read Notion page body for {}: {}",
                page.page_id, e
            ),
        }
    }
}

fn parse_error_body(body: &str) -> String {
    if let Ok(v) = serde_json::from_str::<Value>(body) {
        if let Some(msg) = v.get("message").and_then(|m| m.as_str()) {
            return msg.to_string();
        }
    }
    let trimmed = body.trim();
    if trimmed.is_empty() {
        "Notion request failed.".to_string()
    } else {
        trimmed.chars().take(240).collect()
    }
}

fn looks_like_missing_database(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    lower.contains("could not find database") || lower.contains("object_not_found")
}

fn explain_database_access_error(message: &str, database_id: &str) -> String {
    if looks_like_missing_database(message) {
        format!(
            "Harvy can't open Notion database {database_id}. The URL is fine — Harvy just doesn't have access yet. In Notion: … → Connections → Manage connections → Internal → Harvy, then select that database."
        )
    } else {
        message.to_string()
    }
}

/// Combine form fields with the saved connection. A new database ID must be used
/// even when the token field is left blank (“keep existing secret”).
fn merge_notion_credentials(
    saved: Option<&NotionIdeasConfig>,
    token: Option<&str>,
    database_id_or_url: Option<&str>,
) -> Result<(String, String), String> {
    let token_in = token.map(str::trim).filter(|s| !s.is_empty());
    let id_in = database_id_or_url.map(str::trim).filter(|s| !s.is_empty());

    let auth_token = match token_in {
        Some(t) => t.to_string(),
        None => saved
            .map(|c| c.token.clone())
            .filter(|t| !t.trim().is_empty())
            .ok_or_else(|| "Paste your Notion integration secret.".to_string())?,
    };
    let database_id = match id_in {
        Some(id) => normalize_notion_database_id(id)?,
        None => saved
            .map(|c| c.database_id.clone())
            .filter(|id| !id.trim().is_empty())
            .ok_or_else(|| "Enter a Notion database URL or ID.".to_string())?,
    };
    Ok((auth_token, database_id))
}

fn require_config(app: &AppHandle) -> Result<NotionIdeasConfig, String> {
    let config = read_config(app)?
        .ok_or_else(|| "Notion is not connected. Add your integration in Settings → Research.".to_string())?;
    if config.token.trim().is_empty() {
        return Err("Notion integration token is missing.".to_string());
    }
    if config.database_id.trim().is_empty() {
        return Err("Notion database ID is missing.".to_string());
    }
    Ok(config)
}

fn retrieve_database_json(
    client: &Client,
    token: &str,
    database_id: &str,
) -> Result<Value, String> {
    let url = format!("{}/databases/{}", NOTION_API_BASE, database_id);
    let response = client
        .get(&url)
        .headers(notion_headers(token)?)
        .send()
        .map_err(|e| format!("Notion request failed: {}", e))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|e| format!("Could not read Notion response: {}", e))?;
    if status.is_success() {
        return serde_json::from_str(&body).map_err(|e| format!("Invalid Notion schema JSON: {}", e));
    }

    let message = parse_error_body(&body);
    if looks_like_missing_database(&message) {
        let page_url = format!("{}/pages/{}", NOTION_API_BASE, database_id);
        if let Ok(page_resp) = client.get(&page_url).headers(notion_headers(token)?).send() {
            if page_resp.status().is_success() {
                return Err(
                    "That ID is a Notion page, not a database. Open the database as a full page and copy its URL from the address bar."
                        .to_string(),
                );
            }
        }
    }
    Err(explain_database_access_error(&message, database_id))
}

#[tauri::command]
pub fn notion_get_ideas_config(app: AppHandle) -> Result<NotionIdeasConfigPublic, String> {
    match read_config(&app)? {
        None => Ok(NotionIdeasConfigPublic {
            connected: false,
            database_id: String::new(),
            title_property: String::new(),
            notes_property: String::new(),
            status_property: String::new(),
            idea_status_value: DEFAULT_IDEA_STATUS.to_string(),
            started_status_value: DEFAULT_STARTED_STATUS.to_string(),
            published_status_value: DEFAULT_PUBLISHED_STATUS.to_string(),
            url_property: String::new(),
            date_property: String::new(),
            has_token: false,
        }),
        Some(c) => Ok(NotionIdeasConfigPublic {
            connected: !c.token.trim().is_empty() && !c.database_id.trim().is_empty(),
            database_id: c.database_id,
            title_property: c.title_property,
            notes_property: c.notes_property,
            status_property: c.status_property,
            idea_status_value: if c.idea_status_value.trim().is_empty() {
                DEFAULT_IDEA_STATUS.to_string()
            } else {
                c.idea_status_value
            },
            started_status_value: if c.started_status_value.trim().is_empty() {
                DEFAULT_STARTED_STATUS.to_string()
            } else {
                c.started_status_value
            },
            published_status_value: if c.published_status_value.trim().is_empty() {
                DEFAULT_PUBLISHED_STATUS.to_string()
            } else {
                c.published_status_value
            },
            url_property: c.url_property,
            date_property: c.date_property,
            has_token: !c.token.trim().is_empty(),
        }),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionSaveConfigInput {
    pub token: String,
    pub database_id_or_url: String,
    pub title_property: String,
    pub notes_property: String,
    pub status_property: String,
    pub idea_status_value: Option<String>,
    pub started_status_value: Option<String>,
    pub published_status_value: Option<String>,
    pub url_property: Option<String>,
    pub date_property: Option<String>,
    /// When true and token is empty, keep the previously saved token.
    pub keep_existing_token: Option<bool>,
}

#[tauri::command]
pub fn notion_save_ideas_config(
    app: AppHandle,
    input: NotionSaveConfigInput,
) -> Result<NotionIdeasConfigPublic, String> {
    let database_id = normalize_notion_database_id(&input.database_id_or_url)?;
    let existing = read_config(&app)?;
    let keep = input.keep_existing_token.unwrap_or(false);
    let token = if input.token.trim().is_empty() && keep {
        existing
            .as_ref()
            .map(|c| c.token.clone())
            .unwrap_or_default()
    } else {
        input.token.trim().to_string()
    };
    if token.is_empty() {
        return Err("Paste your Notion integration secret.".to_string());
    }
    if input.title_property.trim().is_empty() {
        return Err("Choose a Title property.".to_string());
    }
    if input.status_property.trim().is_empty() {
        return Err("Choose a Status property.".to_string());
    }

    let config = NotionIdeasConfig {
        token,
        database_id,
        title_property: input.title_property.trim().to_string(),
        notes_property: input.notes_property.trim().to_string(),
        status_property: input.status_property.trim().to_string(),
        idea_status_value: input
            .idea_status_value
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(DEFAULT_IDEA_STATUS)
            .to_string(),
        started_status_value: input
            .started_status_value
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(DEFAULT_STARTED_STATUS)
            .to_string(),
        published_status_value: input
            .published_status_value
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(DEFAULT_PUBLISHED_STATUS)
            .to_string(),
        url_property: input.url_property.as_ref().map_or_else(
            || {
                existing
                    .as_ref()
                    .map(|c| c.url_property.clone())
                    .unwrap_or_default()
            },
            |s| s.trim().to_string(),
        ),
        date_property: input.date_property.as_ref().map_or_else(
            || {
                existing
                    .as_ref()
                    .map(|c| c.date_property.clone())
                    .unwrap_or_default()
            },
            |s| s.trim().to_string(),
        ),
    };
    write_config(&app, &config)?;
    notion_get_ideas_config(app)
}

#[tauri::command]
pub fn notion_clear_ideas_config(app: AppHandle) -> Result<(), String> {
    let path = config_path(&app)?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Could not clear Notion config: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn notion_fetch_database_schema(
    app: AppHandle,
    token: Option<String>,
    database_id_or_url: Option<String>,
) -> Result<Vec<NotionPropertyInfo>, String> {
    let saved = read_config(&app)?;
    let (auth_token, database_id) = merge_notion_credentials(
        saved.as_ref(),
        token.as_deref(),
        database_id_or_url.as_deref(),
    )?;

    let client = notion_client()?;
    let parsed = retrieve_database_json(&client, &auth_token, &database_id)?;
    let props = parsed
        .get("properties")
        .and_then(|p| p.as_object())
        .ok_or_else(|| "Notion database has no properties.".to_string())?;

    let mut out: Vec<NotionPropertyInfo> = props
        .iter()
        .map(|(name, prop)| NotionPropertyInfo {
            name: name.clone(),
            property_type: prop
                .get("type")
                .and_then(|t| t.as_str())
                .unwrap_or("unknown")
                .to_string(),
            options: property_select_options(prop),
        })
        .collect();
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

fn property_select_options(prop: &Value) -> Vec<String> {
    let prop_type = prop.get("type").and_then(|v| v.as_str()).unwrap_or("");
    let container = match prop_type {
        "status" => prop.get("status"),
        "select" => prop.get("select"),
        _ => return Vec::new(),
    };
    let Some(options) = container
        .and_then(|c| c.get("options"))
        .and_then(|o| o.as_array())
    else {
        return Vec::new();
    };
    options
        .iter()
        .filter_map(|opt| opt.get("name").and_then(|n| n.as_str()))
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .collect()
}

fn status_property_type(schema_props: &Value, status_property: &str) -> Option<String> {
    schema_props
        .get(status_property)
        .and_then(|p| p.get("type"))
        .and_then(|t| t.as_str())
        .map(str::to_string)
}

#[tauri::command]
pub fn notion_query_idea_pages(app: AppHandle) -> Result<Vec<NotionIdeaPage>, String> {
    let config = require_config(&app)?;
    let client = notion_client()?;
    let mut results = query_idea_database_pages(&client, &config)?;
    fill_page_bodies(&client, &config.token, &mut results);
    Ok(results)
}

fn query_idea_database_pages(
    client: &Client,
    config: &NotionIdeasConfig,
) -> Result<Vec<NotionIdeaPage>, String> {
    // Load schema to know status vs select for filtering.
    let schema = retrieve_database_json(&client, &config.token, &config.database_id)?;
    let props = schema.get("properties").cloned().unwrap_or(Value::Null);
    let status_type = status_property_type(&props, &config.status_property)
        .unwrap_or_else(|| "status".to_string());

    let idea = if config.idea_status_value.trim().is_empty() {
        DEFAULT_IDEA_STATUS.to_string()
    } else {
        config.idea_status_value.trim().to_string()
    };

    let filter = match status_type.as_str() {
        "select" => json!({
            "property": config.status_property,
            "select": { "equals": idea }
        }),
        _ => json!({
            "property": config.status_property,
            "status": { "equals": idea }
        }),
    };

    let mut results: Vec<NotionIdeaPage> = Vec::new();
    let mut start_cursor: Option<String> = None;

    loop {
        let mut body = json!({
            "page_size": 100,
            "filter": filter,
            "sorts": [{ "timestamp": "created_time", "direction": "descending" }]
        });
        if let Some(cursor) = &start_cursor {
            body["start_cursor"] = json!(cursor);
        }

        let url = format!("{}/databases/{}/query", NOTION_API_BASE, config.database_id);
        let response = client
            .post(&url)
            .headers(notion_headers(&config.token)?)
            .json(&body)
            .send()
            .map_err(|e| format!("Notion query failed: {}", e))?;
        let status = response.status();
        let text = response
            .text()
            .map_err(|e| format!("Could not read Notion response: {}", e))?;
        if !status.is_success() {
            let message = parse_error_body(&text);
            if looks_like_missing_database(&message) {
                return Err(explain_database_access_error(&message, &config.database_id));
            }
            // If filter fails (e.g. empty status), fall back to unfiltered + client filter.
            if results.is_empty() && start_cursor.is_none() {
                return query_ideas_unfiltered(client, config, &idea);
            }
            return Err(message);
        }

        let parsed: Value =
            serde_json::from_str(&text).map_err(|e| format!("Invalid Notion query JSON: {}", e))?;
        let pages = parsed
            .get("results")
            .and_then(|r| r.as_array())
            .cloned()
            .unwrap_or_default();

        for page in pages {
            if let Some(idea_page) = page_to_idea(&page, &config) {
                if !idea_page.status.eq_ignore_ascii_case(&idea) {
                    continue;
                }
                results.push(idea_page);
            }
        }

        let has_more = parsed
            .get("has_more")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if !has_more {
            break;
        }
        start_cursor = parsed
            .get("next_cursor")
            .and_then(|c| c.as_str())
            .map(str::to_string);
        if start_cursor.is_none() {
            break;
        }
    }

    Ok(results)
}

fn query_ideas_unfiltered(
    client: &Client,
    config: &NotionIdeasConfig,
    idea_status: &str,
) -> Result<Vec<NotionIdeaPage>, String> {
    let mut results: Vec<NotionIdeaPage> = Vec::new();
    let mut start_cursor: Option<String> = None;

    loop {
        let mut body = json!({
            "page_size": 100,
            "sorts": [{ "timestamp": "created_time", "direction": "descending" }]
        });
        if let Some(cursor) = &start_cursor {
            body["start_cursor"] = json!(cursor);
        }

        let url = format!("{}/databases/{}/query", NOTION_API_BASE, config.database_id);
        let response = client
            .post(&url)
            .headers(notion_headers(&config.token)?)
            .json(&body)
            .send()
            .map_err(|e| format!("Notion query failed: {}", e))?;
        let status = response.status();
        let text = response
            .text()
            .map_err(|e| format!("Could not read Notion response: {}", e))?;
        if !status.is_success() {
            return Err(explain_database_access_error(
                &parse_error_body(&text),
                &config.database_id,
            ));
        }

        let parsed: Value =
            serde_json::from_str(&text).map_err(|e| format!("Invalid Notion query JSON: {}", e))?;
        let pages = parsed
            .get("results")
            .and_then(|r| r.as_array())
            .cloned()
            .unwrap_or_default();

        for page in pages {
            if let Some(idea_page) = page_to_idea(&page, config) {
                if !idea_page.status.eq_ignore_ascii_case(idea_status) {
                    continue;
                }
                results.push(idea_page);
            }
        }

        let has_more = parsed
            .get("has_more")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if !has_more {
            break;
        }
        start_cursor = parsed
            .get("next_cursor")
            .and_then(|c| c.as_str())
            .map(str::to_string);
        if start_cursor.is_none() {
            break;
        }
    }

    Ok(results)
}

fn page_to_idea(page: &Value, config: &NotionIdeasConfig) -> Option<NotionIdeaPage> {
    let page_id = page.get("id")?.as_str()?.to_string();
    let created_time = page
        .get("created_time")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let properties = page.get("properties")?;

    let title = properties
        .get(&config.title_property)
        .map(property_plain_text)
        .unwrap_or_default();
    let notes = idea_property_notes(properties, config);
    let status = properties
        .get(&config.status_property)
        .map(property_plain_text)
        .unwrap_or_default();

    Some(NotionIdeaPage {
        page_id,
        title,
        notes,
        status,
        created_time,
    })
}

#[tauri::command]
pub fn notion_mark_idea_started(app: AppHandle, page_id: String) -> Result<(), String> {
    let config = require_config(&app)?;
    let trimmed = page_id.trim();
    if trimmed.is_empty() {
        return Err("Missing Notion page id.".to_string());
    }

    let client = notion_client()?;

    // Detect status vs select for the patch payload.
    let schema = retrieve_database_json(&client, &config.token, &config.database_id).unwrap_or(Value::Null);
    let props = schema.get("properties").cloned().unwrap_or(Value::Null);
    let status_type = status_property_type(&props, &config.status_property)
        .unwrap_or_else(|| "status".to_string());

    let started = if config.started_status_value.trim().is_empty() {
        DEFAULT_STARTED_STATUS.to_string()
    } else {
        config.started_status_value.trim().to_string()
    };

    let property_value = match status_type.as_str() {
        "select" => json!({ "select": { "name": started } }),
        _ => json!({ "status": { "name": started } }),
    };

    let body = json!({
        "properties": {
            config.status_property.clone(): property_value
        }
    });

    let url = format!("{}/pages/{}", NOTION_API_BASE, trimmed);
    let response = client
        .patch(&url)
        .headers(notion_headers(&config.token)?)
        .json(&body)
        .send()
        .map_err(|e| format!("Notion update failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("Could not read Notion response: {}", e))?;
    if !status.is_success() {
        return Err(parse_error_body(&text));
    }
    Ok(())
}

fn status_property_payload(status_type: &str, name: &str) -> Value {
    match status_type {
        "select" => json!({ "select": { "name": name } }),
        _ => json!({ "status": { "name": name } }),
    }
}

fn infer_date_property_name(schema_props: &Value) -> String {
    let Some(obj) = schema_props.as_object() else {
        return String::new();
    };
    let dates: Vec<String> = obj
        .iter()
        .filter(|(_, prop)| prop.get("type").and_then(|t| t.as_str()) == Some("date"))
        .map(|(name, _)| name.clone())
        .collect();
    dates
        .iter()
        .find(|name| {
            let lower = name.to_ascii_lowercase();
            lower == "publish date"
                || lower == "published date"
                || lower == "date published"
                || lower == "published"
        })
        .cloned()
        .or_else(|| {
            dates
                .iter()
                .find(|name| name.to_ascii_lowercase().contains("publish"))
                .cloned()
        })
        .or_else(|| dates.first().cloned())
        .unwrap_or_default()
}

fn looks_like_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes.iter().enumerate().all(|(i, ch)| {
            if i == 4 || i == 7 {
                true
            } else {
                ch.is_ascii_digit()
            }
        })
}

#[tauri::command]
pub fn notion_mark_essay_published(
    app: AppHandle,
    page_id: String,
    publish_date: String,
) -> Result<(), String> {
    let config = require_config(&app)?;
    let Some(page_id) = parse_stored_notion_id(&page_id) else {
        return Err("Missing Notion page for this essay.".to_string());
    };
    let publish_date = publish_date.trim().to_string();
    if !looks_like_iso_date(&publish_date) {
        return Err("Publish date must be YYYY-MM-DD.".to_string());
    }

    let client = notion_client()?;
    let schema =
        retrieve_database_json(&client, &config.token, &config.database_id).unwrap_or(Value::Null);
    let props = schema.get("properties").cloned().unwrap_or(Value::Null);
    let status_type = status_property_type(&props, &config.status_property)
        .unwrap_or_else(|| "status".to_string());
    let published = if config.published_status_value.trim().is_empty() {
        DEFAULT_PUBLISHED_STATUS.to_string()
    } else {
        config.published_status_value.trim().to_string()
    };
    let date_property = if config.date_property.trim().is_empty() {
        infer_date_property_name(&props)
    } else {
        config.date_property.trim().to_string()
    };

    let mut properties = serde_json::Map::new();
    if !config.status_property.trim().is_empty() {
        properties.insert(
            config.status_property.clone(),
            status_property_payload(&status_type, &published),
        );
    }
    if !date_property.trim().is_empty() {
        properties.insert(
            date_property,
            json!({ "date": { "start": publish_date } }),
        );
    }
    if properties.is_empty() {
        return Err("No Status or date property configured for publish.".to_string());
    }

    let body = json!({ "properties": properties });
    let url = format!("{}/pages/{}", NOTION_API_BASE, page_id);
    notion_json(
        &client,
        &config.token,
        reqwest::Method::PATCH,
        &url,
        Some(&body),
    )?;
    Ok(())
}

#[tauri::command]
pub fn notion_test_ideas_connection(app: AppHandle) -> Result<usize, String> {
    let config = require_config(&app)?;
    let client = notion_client()?;
    let pages = query_idea_database_pages(&client, &config)?;
    Ok(pages.len())
}

const NOTION_CHILDREN_PAGE_SIZE: usize = 100;
const TITLE_LIMIT: usize = 2000;

#[tauri::command]
pub fn notion_sync_essay(
    app: AppHandle,
    input: NotionSyncEssayInput,
) -> Result<NotionSyncEssayResult, String> {
    let config = require_config(&app)?;
    let client = notion_client()?;
    let title = truncate_chars(input.title.trim(), TITLE_LIMIT);
    let title = if title.is_empty() {
        "Untitled".to_string()
    } else {
        title
    };
    let nested_title = nested_essay_page_title(&title);
    let blocks = markdown_to_notion_blocks(&input.markdown);

    let mut parent_page_id =
        trim_option(&input.parent_page_id).and_then(|id| parse_stored_notion_id(&id));
    let mut essay_page_id =
        trim_option(&input.essay_page_id).and_then(|id| parse_stored_notion_id(&id));
    let mut rename_parent = input.rename_parent;

    if let Some(id) = essay_page_id.clone() {
        if !page_exists(&client, &config.token, &id)? {
            essay_page_id = None;
        }
    }
    if let Some(id) = parent_page_id.clone() {
        if !page_exists(&client, &config.token, &id)? {
            parent_page_id = None;
        }
    }

    if parent_page_id.is_none() {
        let created = create_database_page(&client, &config, &title)?;
        parent_page_id = Some(created);
        rename_parent = true;
    }

    let parent_id = parent_page_id
        .clone()
        .ok_or_else(|| "Could not create a Notion page for this essay.".to_string())?;

    if essay_page_id.is_none() {
        essay_page_id = find_child_page_id(
            &client,
            &config.token,
            &parent_id,
            &[&nested_title, &title],
        )?;
    }
    if essay_page_id.is_none() {
        essay_page_id = Some(create_child_page(
            &client,
            &config.token,
            &parent_id,
            &nested_title,
            &blocks,
        )?);
    } else if let Some(id) = essay_page_id.clone() {
        patch_child_page_title(&client, &config.token, &id, &nested_title)?;
        replace_block_children(&client, &config.token, &id, &blocks)?;
    }

    if rename_parent {
        patch_database_page_title(&client, &config, &parent_id, &title)?;
    }

    let essay_id = essay_page_id
        .clone()
        .ok_or_else(|| "Could not create a Notion page for this essay.".to_string())?;
    let parent_url = retrieve_page_url(&client, &config.token, &parent_id).unwrap_or_default();
    let essay_url = retrieve_page_url(&client, &config.token, &essay_id).unwrap_or_default();

    Ok(NotionSyncEssayResult {
        parent_page_id: parent_id,
        essay_page_id: essay_id,
        rename_parent,
        parent_url,
        essay_url,
    })
}

fn trim_option(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    let mut out = String::new();
    for (i, ch) in value.chars().enumerate() {
        if i >= max_chars {
            break;
        }
        out.push(ch);
    }
    out
}

fn nested_essay_page_title(title: &str) -> String {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return "Untitled Essay".to_string();
    }
    if trimmed.to_ascii_lowercase().ends_with(" essay") {
        return truncate_chars(trimmed, TITLE_LIMIT);
    }
    const SUFFIX: &str = " Essay";
    let max_base = TITLE_LIMIT.saturating_sub(SUFFIX.chars().count());
    format!("{}{}", truncate_chars(trimmed, max_base), SUFFIX)
}

fn title_rich_text(title: &str) -> Value {
    json!([{
        "type": "text",
        "text": { "content": truncate_chars(title, TITLE_LIMIT) }
    }])
}

fn notion_json(
    client: &Client,
    token: &str,
    method: reqwest::Method,
    url: &str,
    body: Option<&Value>,
) -> Result<Value, String> {
    let mut last_error = "Notion request failed.".to_string();
    for attempt in 0..6 {
        let mut request = client
            .request(method.clone(), url)
            .headers(notion_headers(token)?);
        if let Some(payload) = body {
            request = request.json(payload);
        }
        let response = request
            .send()
            .map_err(|e| format!("Notion request failed: {}", e))?;
        let status = response.status();
        let retry_after = response
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok());
        let text = response
            .text()
            .map_err(|e| format!("Could not read Notion response: {}", e))?;
        if status.as_u16() == 429 {
            let wait_ms = retry_after.unwrap_or(1 + attempt as u64) * 250;
            thread::sleep(Duration::from_millis(wait_ms.max(250)));
            last_error = parse_error_body(&text);
            continue;
        }
        if !status.is_success() {
            let message = parse_error_body(&text);
            if message.to_ascii_lowercase().contains("invalid request url") {
                return Err(format!("{message} ({method} {url})"));
            }
            return Err(message);
        }
        if text.trim().is_empty() {
            return Ok(Value::Null);
        }
        return serde_json::from_str(&text).map_err(|e| format!("Invalid Notion JSON: {}", e));
    }
    Err(last_error)
}

fn page_exists(client: &Client, token: &str, page_id: &str) -> Result<bool, String> {
    let Some(page_id) = parse_stored_notion_id(page_id) else {
        return Ok(false);
    };
    let url = format!("{}/pages/{}", NOTION_API_BASE, page_id);
    let response = client
        .get(&url)
        .headers(notion_headers(token)?)
        .send()
        .map_err(|e| format!("Notion page request failed: {}", e))?;
    let status = response.status();
    if status.as_u16() == 404 {
        return Ok(false);
    }
    let text = response
        .text()
        .map_err(|e| format!("Could not read Notion page: {}", e))?;
    if !status.is_success() {
        let message = parse_error_body(&text);
        let lower = message.to_ascii_lowercase();
        if looks_like_missing_database(&message) || lower.contains("invalid request url") {
            return Ok(false);
        }
        return Err(message);
    }
    let parsed: Value =
        serde_json::from_str(&text).map_err(|e| format!("Invalid Notion page JSON: {}", e))?;
    let archived = parsed
        .get("archived")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    Ok(!archived)
}

fn page_url_from_json(parsed: &Value) -> String {
    parsed
        .get("url")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("")
        .to_string()
}

fn retrieve_page_url(client: &Client, token: &str, page_id: &str) -> Result<String, String> {
    let Some(page_id) = parse_stored_notion_id(page_id) else {
        return Ok(String::new());
    };
    let url = format!("{}/pages/{}", NOTION_API_BASE, page_id);
    let parsed = notion_json(client, token, reqwest::Method::GET, &url, None)?;
    Ok(page_url_from_json(&parsed))
}

fn create_database_page(
    client: &Client,
    config: &NotionIdeasConfig,
    title: &str,
) -> Result<String, String> {
    let schema =
        retrieve_database_json(client, &config.token, &config.database_id).unwrap_or(Value::Null);
    let props = schema.get("properties").cloned().unwrap_or(Value::Null);
    let mut properties = serde_json::Map::new();
    properties.insert(
        config.title_property.clone(),
        json!({ "title": title_rich_text(title) }),
    );
    if !config.status_property.trim().is_empty() && !config.started_status_value.trim().is_empty()
    {
        let status_type = status_property_type(&props, &config.status_property)
            .unwrap_or_else(|| "status".to_string());
        let started = config.started_status_value.trim();
        let property_value = match status_type.as_str() {
            "select" => json!({ "select": { "name": started } }),
            _ => json!({ "status": { "name": started } }),
        };
        properties.insert(config.status_property.clone(), property_value);
    }
    let body = json!({
        "parent": { "database_id": config.database_id },
        "properties": properties
    });
    let url = format!("{}/pages", NOTION_API_BASE);
    let parsed = notion_json(client, &config.token, reqwest::Method::POST, &url, Some(&body))?;
    parsed
        .get("id")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .ok_or_else(|| "Notion did not return a page id.".to_string())
}

fn create_child_page(
    client: &Client,
    token: &str,
    parent_page_id: &str,
    title: &str,
    blocks: &[Value],
) -> Result<String, String> {
    let body = json!({
        "parent": { "page_id": parent_page_id },
        "properties": {
            "title": { "title": title_rich_text(title) }
        }
    });
    let url = format!("{}/pages", NOTION_API_BASE);
    let parsed = notion_json(client, token, reqwest::Method::POST, &url, Some(&body))?;
    let page_id = parsed
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Notion did not return a page id.".to_string())?
        .to_string();
    append_block_children(client, token, &page_id, blocks)?;
    Ok(page_id)
}

fn patch_child_page_title(
    client: &Client,
    token: &str,
    page_id: &str,
    title: &str,
) -> Result<(), String> {
    let body = json!({
        "properties": {
            "title": { "title": title_rich_text(title) }
        }
    });
    let url = format!("{}/pages/{}", NOTION_API_BASE, page_id);
    notion_json(client, token, reqwest::Method::PATCH, &url, Some(&body))?;
    Ok(())
}

fn patch_database_page_title(
    client: &Client,
    config: &NotionIdeasConfig,
    page_id: &str,
    title: &str,
) -> Result<(), String> {
    let body = json!({
        "properties": {
            config.title_property.clone(): { "title": title_rich_text(title) }
        }
    });
    let url = format!("{}/pages/{}", NOTION_API_BASE, page_id);
    notion_json(client, &config.token, reqwest::Method::PATCH, &url, Some(&body))?;
    Ok(())
}

fn find_child_page_id(
    client: &Client,
    token: &str,
    parent_page_id: &str,
    titles: &[&str],
) -> Result<Option<String>, String> {
    let wanted: Vec<String> = titles
        .iter()
        .map(|title| title.trim().to_string())
        .filter(|title| !title.is_empty())
        .collect();
    let children = fetch_block_children(client, token, parent_page_id)?;
    for block in children {
        if block.get("type").and_then(|v| v.as_str()) != Some("child_page") {
            continue;
        }
        let name = block
            .get("child_page")
            .and_then(|c| c.get("title"))
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .trim();
        if wanted.iter().any(|title| title == name) {
            if let Some(id) = block.get("id").and_then(|v| v.as_str()) {
                return Ok(Some(id.to_string()));
            }
        }
    }
    Ok(None)
}

fn append_block_children(
    client: &Client,
    token: &str,
    block_id: &str,
    blocks: &[Value],
) -> Result<(), String> {
    for chunk in blocks.chunks(NOTION_CHILDREN_PAGE_SIZE) {
        if chunk.is_empty() {
            continue;
        }
        let url = format!("{}/blocks/{}/children", NOTION_API_BASE, block_id);
        let body = json!({ "children": chunk });
        // Notion's append-children endpoint is PATCH, not POST.
        notion_json(client, token, reqwest::Method::PATCH, &url, Some(&body))?;
    }
    Ok(())
}

fn replace_block_children(
    client: &Client,
    token: &str,
    block_id: &str,
    blocks: &[Value],
) -> Result<(), String> {
    let existing = fetch_block_children(client, token, block_id)?;
    // Write the new body first. If that fails, the previous content is still there.
    append_block_children(client, token, block_id, blocks)?;
    for block in existing {
        let Some(id) = block.get("id").and_then(|v| v.as_str()) else {
            continue;
        };
        let url = format!("{}/blocks/{}", NOTION_API_BASE, id);
        notion_json(client, token, reqwest::Method::DELETE, &url, None)?;
    }
    Ok(())
}

fn looks_like_http_url(value: &str) -> bool {
    let lower = value.trim().to_ascii_lowercase();
    lower.starts_with("http://") || lower.starts_with("https://")
}

fn block_contains_url(block: &Value, public_url: &str) -> bool {
    let wanted = public_url.trim();
    if wanted.is_empty() {
        return false;
    }
    let bookmark = block
        .get("bookmark")
        .and_then(|b| b.get("url"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if bookmark == wanted {
        return true;
    }
    let paragraph = block.get("paragraph").or_else(|| block.get("quote"));
    if let Some(rich) = paragraph
        .and_then(|p| p.get("rich_text"))
        .and_then(|v| v.as_array())
    {
        for item in rich {
            let href = item
                .get("href")
                .and_then(|v| v.as_str())
                .or_else(|| {
                    item.get("text")
                        .and_then(|t| t.get("link"))
                        .and_then(|l| l.get("url"))
                        .and_then(|v| v.as_str())
                })
                .unwrap_or("");
            if href == wanted {
                return true;
            }
        }
    }
    false
}

fn page_already_has_public_url(
    client: &Client,
    token: &str,
    page_id: &str,
    public_url: &str,
) -> Result<bool, String> {
    let children = fetch_block_children(client, token, page_id)?;
    Ok(children
        .iter()
        .any(|block| block_contains_url(block, public_url)))
}

fn append_public_url_bookmark(
    client: &Client,
    token: &str,
    page_id: &str,
    public_url: &str,
) -> Result<(), String> {
    if page_already_has_public_url(client, token, page_id, public_url)? {
        return Ok(());
    }
    let blocks = vec![json!({
        "object": "block",
        "type": "bookmark",
        "bookmark": { "url": public_url }
    })];
    append_block_children(client, token, page_id, &blocks)
}

fn patch_page_url_property(
    client: &Client,
    token: &str,
    page_id: &str,
    property: &str,
    public_url: &str,
) -> Result<(), String> {
    let body = json!({
        "properties": {
            property: { "url": public_url }
        }
    });
    let url = format!("{}/pages/{}", NOTION_API_BASE, page_id);
    notion_json(client, token, reqwest::Method::PATCH, &url, Some(&body))?;
    Ok(())
}

#[tauri::command]
pub fn notion_set_page_public_url(
    app: AppHandle,
    page_id: String,
    public_url: String,
) -> Result<(), String> {
    let config = require_config(&app)?;
    let public_url = public_url.trim().to_string();
    if !looks_like_http_url(&public_url) {
        return Err("Public URL must start with http:// or https://.".to_string());
    }
    let Some(page_id) = parse_stored_notion_id(&page_id) else {
        return Err("Missing Notion page for this essay.".to_string());
    };
    let client = notion_client()?;
    let property = config.url_property.trim();
    if !property.is_empty() {
        match patch_page_url_property(&client, &config.token, &page_id, property, &public_url) {
            Ok(()) => return Ok(()),
            Err(_) => {
                append_public_url_bookmark(&client, &config.token, &page_id, &public_url)?;
                return Ok(());
            }
        }
    }
    append_public_url_bookmark(&client, &config.token, &page_id, &public_url)
}

#[cfg(test)]
mod tests {
    use super::{
        block_contains_url, blocks_to_plain_text, explain_database_access_error,
        idea_property_notes, infer_date_property_name, looks_like_http_url, looks_like_iso_date,
        merge_idea_notes, merge_notion_credentials, nested_essay_page_title,
        normalize_notion_database_id, page_url_from_json, parse_stored_notion_id,
        property_select_options, truncate_chars, NotionIdeasConfig,
    };
    use serde_json::json;

    fn sample_config() -> NotionIdeasConfig {
        NotionIdeasConfig {
            token: "secret_old".to_string(),
            database_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee".to_string(),
            title_property: "Name".to_string(),
            notes_property: "Notes".to_string(),
            status_property: "Status".to_string(),
            idea_status_value: "Idea".to_string(),
            started_status_value: "Started".to_string(),
            published_status_value: "Published".to_string(),
            url_property: String::new(),
            date_property: String::new(),
        }
    }

    #[test]
    fn parses_dashed_uuid() {
        let id = normalize_notion_database_id("a1b2c3d4-e5f6-7890-abcd-ef1234567890").unwrap();
        assert_eq!(id, "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    }

    #[test]
    fn parses_url_with_undashed_id() {
        let id = normalize_notion_database_id(
            "https://www.notion.so/workspace/a1b2c3d4e5f67890abcdef1234567890?v=abc",
        )
        .unwrap();
        assert_eq!(id, "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    }

    #[test]
    fn merge_keeps_saved_token_when_only_database_changes() {
        let saved = sample_config();
        let (token, database_id) = merge_notion_credentials(
            Some(&saved),
            None,
            Some("fc18c16a-5124-4937-81c2-17f7bf0172cf"),
        )
        .unwrap();
        assert_eq!(token, "secret_old");
        assert_eq!(database_id, "fc18c16a-5124-4937-81c2-17f7bf0172cf");
    }

    #[test]
    fn explains_unshared_database() {
        let message = explain_database_access_error(
            "Could not find database with ID: fc18c16a-5124-4937-81c2-17f7bf0172cf. Make sure the relevant pages and databases are shared with your integration \"Harvy\".",
            "fc18c16a-5124-4937-81c2-17f7bf0172cf",
        );
        assert!(message.contains("Manage connections"));
        assert!(message.contains("Internal"));
        assert!(message.contains("Harvy"));
        assert!(message.contains("fc18c16a-5124-4937-81c2-17f7bf0172cf"));
    }

    #[test]
    fn extracts_page_body_paragraphs() {
        let blocks = json!([
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{ "plain_text": "Core idea: Ambition supplies energy, not direction." }]
                }
            },
            {
                "type": "paragraph",
                "paragraph": { "rich_text": [] }
            },
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{ "plain_text": "Podcast expansion: What ambition is genuinely good for." }]
                }
            }
        ]);
        assert_eq!(
            blocks_to_plain_text(blocks.as_array().unwrap()),
            "Core idea: Ambition supplies energy, not direction.\n\nPodcast expansion: What ambition is genuinely good for."
        );
    }

    #[test]
    fn collects_rich_text_properties_as_notes() {
        let properties = json!({
            "Name": { "type": "title", "title": [{ "plain_text": "Essay" }] },
            "Status": { "type": "status", "status": { "name": "Idea" } },
            "Core idea": {
                "type": "rich_text",
                "rich_text": [{ "plain_text": "Ambition supplies energy, not direction." }]
            },
            "Podcast expansion": {
                "type": "rich_text",
                "rich_text": [{ "plain_text": "What ambition is genuinely good for." }]
            }
        });
        let notes = idea_property_notes(&properties, &sample_config());
        assert!(notes.contains("Core idea: Ambition supplies energy, not direction."));
        assert!(notes.contains("Podcast expansion: What ambition is genuinely good for."));
    }

    #[test]
    fn merge_keeps_property_notes_when_page_body_is_empty() {
        assert_eq!(
            merge_idea_notes("Core idea: Hello", ""),
            "Core idea: Hello"
        );
        assert_eq!(
            merge_idea_notes("", "Page body"),
            "Page body"
        );
    }

    #[test]
    fn extracts_status_and_select_options() {
        let status = json!({
            "type": "status",
            "status": {
                "options": [
                    { "name": "Idea" },
                    { "name": "Writing" },
                    { "name": "  " }
                ]
            }
        });
        assert_eq!(
            property_select_options(&status),
            vec!["Idea".to_string(), "Writing".to_string()]
        );

        let select = json!({
            "type": "select",
            "select": {
                "options": [{ "name": "Not started" }, { "name": "Done" }]
            }
        });
        assert_eq!(
            property_select_options(&select),
            vec!["Not started".to_string(), "Done".to_string()]
        );
    }

    #[test]
    fn truncate_chars_respects_limit() {
        assert_eq!(truncate_chars("Hello", 3), "Hel");
        assert_eq!(truncate_chars("ééé", 2), "éé");
    }

    #[test]
    fn nested_page_title_appends_essay() {
        assert_eq!(
            nested_essay_page_title("Ambition Won't Tell You Where to Go"),
            "Ambition Won't Tell You Where to Go Essay"
        );
        assert_eq!(
            nested_essay_page_title("Ambition Won't Tell You Where to Go Essay"),
            "Ambition Won't Tell You Where to Go Essay"
        );
        assert_eq!(nested_essay_page_title("  "), "Untitled Essay");
    }

    #[test]
    fn stored_notion_ids_must_be_uuids() {
        assert_eq!(
            parse_stored_notion_id("277ba25e-3f4a-80c3-bc7f-d3f6c4e8f1a2").as_deref(),
            Some("277ba25e-3f4a-80c3-bc7f-d3f6c4e8f1a2")
        );
        assert_eq!(
            parse_stored_notion_id("277ba25e3f4a80c3bc7fd3f6c4e8f1a2").as_deref(),
            Some("277ba25e-3f4a-80c3-bc7f-d3f6c4e8f1a2")
        );
        assert_eq!(parse_stored_notion_id("asdfasdfasdf Essay"), None);
        assert_eq!(parse_stored_notion_id("asdfasdfasdf"), None);
    }

    #[test]
    fn extracts_page_url_from_notion_json() {
        let parsed = json!({
            "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            "url": "https://www.notion.so/workspace/Hello-aaaaaaaa"
        });
        assert_eq!(
            page_url_from_json(&parsed),
            "https://www.notion.so/workspace/Hello-aaaaaaaa"
        );
        assert_eq!(page_url_from_json(&json!({})), "");
    }

    #[test]
    fn detects_http_urls_and_existing_bookmarks() {
        assert!(looks_like_http_url("https://alex.substack.com/p/hello"));
        assert!(!looks_like_http_url("notion.so/page"));
        let bookmark = json!({
            "type": "bookmark",
            "bookmark": { "url": "https://alex.substack.com/p/hello" }
        });
        assert!(block_contains_url(
            &bookmark,
            "https://alex.substack.com/p/hello"
        ));
        assert!(!block_contains_url(
            &bookmark,
            "https://alex.substack.com/p/other"
        ));
    }

    #[test]
    fn infers_publish_date_property() {
        let props = json!({
            "Name": { "type": "title" },
            "Created": { "type": "date" },
            "Publish Date": { "type": "date" }
        });
        assert_eq!(infer_date_property_name(&props), "Publish Date");
        assert!(looks_like_iso_date("2026-09-10"));
        assert!(!looks_like_iso_date("09/10/2026"));
    }
}
