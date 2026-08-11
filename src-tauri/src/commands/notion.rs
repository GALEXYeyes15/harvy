//! Notion Ideas sync — integration token + database query/update.
//! Config lives in the app config dir (not Vite env).

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::time::Duration;
use tauri::AppHandle;

use super::app_config_dir;

const NOTION_API_BASE: &str = "https://api.notion.com/v1";
const NOTION_VERSION: &str = "2022-06-28";
const CONFIG_FILE_NAME: &str = "notion-ideas.json";
const DEFAULT_IDEA_STATUS: &str = "Idea";
const DEFAULT_STARTED_STATUS: &str = "Started";

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
}

fn default_idea_status() -> String {
    DEFAULT_IDEA_STATUS.to_string()
}

fn default_started_status() -> String {
    DEFAULT_STARTED_STATUS.to_string()
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
    /// Whether a token is stored (never returns the secret).
    pub has_token: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotionPropertyInfo {
    pub name: String,
    /// Notion property type: title, rich_text, status, select, etc.
    pub property_type: String,
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
    let (auth_token, database_id) = match (token, database_id_or_url) {
        (Some(t), Some(id)) if !t.trim().is_empty() && !id.trim().is_empty() => {
            (t.trim().to_string(), normalize_notion_database_id(&id)?)
        }
        _ => {
            let config = require_config(&app)?;
            (config.token, config.database_id)
        }
    };

    let client = notion_client()?;
    let url = format!("{}/databases/{}", NOTION_API_BASE, database_id);
    let response = client
        .get(&url)
        .headers(notion_headers(&auth_token)?)
        .send()
        .map_err(|e| format!("Notion request failed: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .map_err(|e| format!("Could not read Notion response: {}", e))?;
    if !status.is_success() {
        return Err(parse_error_body(&body));
    }

    let parsed: Value =
        serde_json::from_str(&body).map_err(|e| format!("Invalid Notion schema JSON: {}", e))?;
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
        })
        .collect();
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
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

    // Load schema to know status vs select for filtering.
    let schema_url = format!("{}/databases/{}", NOTION_API_BASE, config.database_id);
    let schema_resp = client
        .get(&schema_url)
        .headers(notion_headers(&config.token)?)
        .send()
        .map_err(|e| format!("Notion request failed: {}", e))?;
    let schema_status = schema_resp.status();
    let schema_body = schema_resp
        .text()
        .map_err(|e| format!("Could not read Notion response: {}", e))?;
    if !schema_status.is_success() {
        return Err(parse_error_body(&schema_body));
    }
    let schema: Value = serde_json::from_str(&schema_body)
        .map_err(|e| format!("Invalid Notion schema JSON: {}", e))?;
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
            // If filter fails (e.g. empty status), fall back to unfiltered + client filter.
            if results.is_empty() && start_cursor.is_none() {
                return query_ideas_unfiltered(&client, &config, &idea);
            }
            return Err(parse_error_body(&text));
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
            return Err(parse_error_body(&text));
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
    let notes = if config.notes_property.trim().is_empty() {
        String::new()
    } else {
        properties
            .get(&config.notes_property)
            .map(property_plain_text)
            .unwrap_or_default()
    };
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
    let schema_url = format!("{}/databases/{}", NOTION_API_BASE, config.database_id);
    let schema_resp = client
        .get(&schema_url)
        .headers(notion_headers(&config.token)?)
        .send()
        .map_err(|e| format!("Notion request failed: {}", e))?;
    let schema_body = schema_resp
        .text()
        .map_err(|e| format!("Could not read Notion response: {}", e))?;
    let schema: Value = serde_json::from_str(&schema_body).unwrap_or(Value::Null);
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

#[tauri::command]
pub fn notion_test_ideas_connection(app: AppHandle) -> Result<usize, String> {
    let pages = notion_query_idea_pages(app)?;
    Ok(pages.len())
}

#[cfg(test)]
mod tests {
    use super::normalize_notion_database_id;

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
}
