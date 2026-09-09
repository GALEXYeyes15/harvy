//! AI check — OpenAI / Anthropic API key, model discovery, on-demand essay review.
//! Config lives in the app config dir (not Vite env).

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::time::Duration;
use tauri::AppHandle;

use super::app_config_dir;

const CONFIG_FILE_NAME: &str = "ai-check.json";
const ANTHROPIC_VERSION: &str = "2023-06-01";
const MAX_ESSAY_CHARS: usize = 120_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AiProvider {
    Openai,
    Anthropic,
}

impl AiProvider {
    fn as_str(self) -> &'static str {
        match self {
            AiProvider::Openai => "openai",
            AiProvider::Anthropic => "anthropic",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCheckConfig {
    pub api_key: String,
    pub provider: AiProvider,
    pub model: String,
    #[serde(default)]
    pub enabled: bool,
    /// When true, AI check popovers include a “Replace with…” action.
    #[serde(default = "default_true")]
    pub show_replace_suggestions: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCheckConfigPublic {
    pub connected: bool,
    pub provider: Option<AiProvider>,
    pub model: String,
    pub enabled: bool,
    pub show_replace_suggestions: bool,
    pub has_api_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCheckSaveInput {
    pub api_key: String,
    pub model: Option<String>,
    pub enabled: Option<bool>,
    pub show_replace_suggestions: Option<bool>,
    /// When true and `api_key` is blank, keep the stored key.
    pub keep_existing_key: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModelInfo {
    pub id: String,
    pub provider: AiProvider,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCheckIssue {
    pub r#type: String,
    pub text: String,
    #[serde(default)]
    pub suggestion: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCheckUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiCheckResult {
    pub issues: Vec<AiCheckIssue>,
    pub model: String,
    pub provider: AiProvider,
    pub usage: AiCheckUsage,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PodcastNotesResult {
    pub markdown: String,
    pub model: String,
    pub provider: AiProvider,
    pub usage: AiCheckUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeadlinePair {
    pub title: String,
    #[serde(default)]
    pub subtitle: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeadlinePairsResult {
    pub pairs: Vec<HeadlinePair>,
    pub model: String,
    pub provider: AiProvider,
    pub usage: AiCheckUsage,
}

struct ModelCheckResponse {
    text: String,
    usage: AiCheckUsage,
}

fn config_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app_config_dir(app)?.join(CONFIG_FILE_NAME))
}

fn read_config(app: &AppHandle) -> Result<Option<AiCheckConfig>, String> {
    let path = config_path(app)?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path)
        .map_err(|e| format!("Could not read AI check config '{}': {}", path.display(), e))?;
    let parsed: AiCheckConfig = serde_json::from_str(&text)
        .map_err(|e| format!("Could not parse AI check config: {}", e))?;
    Ok(Some(parsed))
}

fn write_config(app: &AppHandle, config: &AiCheckConfig) -> Result<(), String> {
    let path = config_path(app)?;
    let text = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Could not serialize AI check config: {}", e))?;
    fs::write(&path, text)
        .map_err(|e| format!("Could not save AI check config '{}': {}", path.display(), e))?;
    Ok(())
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("Could not build HTTP client: {}", e))
}

/// Detect provider from common API key prefixes.
pub fn detect_provider_from_key(api_key: &str) -> Result<AiProvider, String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("API key is empty.".to_string());
    }
    if key.starts_with("sk-ant-") {
        return Ok(AiProvider::Anthropic);
    }
    // OpenAI user/project keys typically start with sk- or sk-proj-
    if key.starts_with("sk-") {
        return Ok(AiProvider::Openai);
    }
    Err(
        "Unrecognized API key. Use an OpenAI key (sk-…) or Anthropic key (sk-ant-…).".to_string(),
    )
}

fn to_public(config: Option<&AiCheckConfig>) -> AiCheckConfigPublic {
    match config {
        Some(c) if !c.api_key.trim().is_empty() => AiCheckConfigPublic {
            connected: true,
            provider: Some(c.provider),
            model: c.model.clone(),
            enabled: c.enabled,
            show_replace_suggestions: c.show_replace_suggestions,
            has_api_key: true,
        },
        Some(c) => AiCheckConfigPublic {
            connected: false,
            provider: Some(c.provider),
            model: c.model.clone(),
            enabled: c.enabled,
            show_replace_suggestions: c.show_replace_suggestions,
            has_api_key: false,
        },
        None => AiCheckConfigPublic {
            connected: false,
            provider: None,
            model: String::new(),
            enabled: false,
            show_replace_suggestions: true,
            has_api_key: false,
        },
    }
}

fn is_useful_openai_model(id: &str) -> bool {
    let lower = id.to_ascii_lowercase();
    if !(lower.starts_with("gpt-") || lower.starts_with("o1") || lower.starts_with("o3") || lower.starts_with("o4") || lower.starts_with("chatgpt-")) {
        return false;
    }
    let blocked = [
        "instruct",
        "embedding",
        "realtime",
        "audio",
        "tts",
        "transcribe",
        "moderation",
        "image",
        "davinci",
        "babbage",
        "ada",
        "curie",
        "whisper",
        "dall-e",
    ];
    !blocked.iter().any(|b| lower.contains(b))
}

fn is_useful_anthropic_model(id: &str) -> bool {
    let lower = id.to_ascii_lowercase();
    lower.starts_with("claude-")
}

fn list_openai_models(client: &Client, api_key: &str) -> Result<Vec<AiModelInfo>, String> {
    let response = client
        .get("https://api.openai.com/v1/models")
        .bearer_auth(api_key.trim())
        .send()
        .map_err(|e| format!("OpenAI models request failed: {}", e))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|e| format!("Could not read OpenAI models response: {}", e))?;
    if !status.is_success() {
        return Err(format_api_error("OpenAI", status.as_u16(), &body));
    }
    let parsed: Value = serde_json::from_str(&body)
        .map_err(|e| format!("Could not parse OpenAI models JSON: {}", e))?;
    let mut models: Vec<AiModelInfo> = parsed
        .get("data")
        .and_then(|d| d.as_array())
        .into_iter()
        .flatten()
        .filter_map(|item| {
            let id = item.get("id")?.as_str()?;
            if !is_useful_openai_model(id) {
                return None;
            }
            Some(AiModelInfo {
                id: id.to_string(),
                provider: AiProvider::Openai,
            })
        })
        .collect();
    models.sort_by(|a, b| a.id.to_lowercase().cmp(&b.id.to_lowercase()));
    models.dedup_by(|a, b| a.id == b.id);
    if models.is_empty() {
        // Fallback curated list when the account returns nothing useful
        models = vec![
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4.1",
            "gpt-4.1-mini",
            "o3-mini",
        ]
        .into_iter()
        .map(|id| AiModelInfo {
            id: id.to_string(),
            provider: AiProvider::Openai,
        })
        .collect();
    }
    Ok(models)
}

fn list_anthropic_models(client: &Client, api_key: &str) -> Result<Vec<AiModelInfo>, String> {
    let response = client
        .get("https://api.anthropic.com/v1/models")
        .header("x-api-key", api_key.trim())
        .header("anthropic-version", ANTHROPIC_VERSION)
        .send()
        .map_err(|e| format!("Anthropic models request failed: {}", e))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|e| format!("Could not read Anthropic models response: {}", e))?;
    if !status.is_success() {
        return Err(format_api_error("Anthropic", status.as_u16(), &body));
    }
    let parsed: Value = serde_json::from_str(&body)
        .map_err(|e| format!("Could not parse Anthropic models JSON: {}", e))?;
    let mut models: Vec<AiModelInfo> = parsed
        .get("data")
        .and_then(|d| d.as_array())
        .into_iter()
        .flatten()
        .filter_map(|item| {
            let id = item.get("id")?.as_str()?;
            if !is_useful_anthropic_model(id) {
                return None;
            }
            Some(AiModelInfo {
                id: id.to_string(),
                provider: AiProvider::Anthropic,
            })
        })
        .collect();
    models.sort_by(|a, b| a.id.to_lowercase().cmp(&b.id.to_lowercase()));
    models.dedup_by(|a, b| a.id == b.id);
    if models.is_empty() {
        models = vec![
            "claude-sonnet-4-20250514",
            "claude-3-5-haiku-20241022",
            "claude-opus-4-20250514",
        ]
        .into_iter()
        .map(|id| AiModelInfo {
            id: id.to_string(),
            provider: AiProvider::Anthropic,
        })
        .collect();
    }
    Ok(models)
}

fn format_api_error(provider: &str, status: u16, body: &str) -> String {
    let message = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| {
            v.pointer("/error/message")
                .and_then(|m| m.as_str())
                .map(|s| s.to_string())
                .or_else(|| {
                    v.get("error")
                        .and_then(|e| e.as_object())
                        .and_then(|o| o.get("message"))
                        .and_then(|m| m.as_str())
                        .map(|s| s.to_string())
                })
                .or_else(|| {
                    v.get("message")
                        .and_then(|m| m.as_str())
                        .map(|s| s.to_string())
                })
        })
        .unwrap_or_else(|| {
            let trimmed = body.trim();
            if trimmed.len() > 240 {
                format!("{}…", &trimmed[..240])
            } else if trimmed.is_empty() {
                "Unknown error".to_string()
            } else {
                trimmed.to_string()
            }
        });
    format!("{} API error ({}): {}", provider, status, message)
}

fn resolve_key_for_request(
    app: &AppHandle,
    api_key_override: Option<&str>,
) -> Result<(String, AiProvider, String, bool), String> {
    let stored = read_config(app)?;
    let key = api_key_override
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| stored.as_ref().map(|c| c.api_key.clone()))
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| "Add an OpenAI or Anthropic API key first.".to_string())?;
    let provider = detect_provider_from_key(&key)?;
    let model = stored
        .as_ref()
        .map(|c| c.model.clone())
        .unwrap_or_default();
    let enabled = stored.as_ref().map(|c| c.enabled).unwrap_or(false);
    Ok((key, provider, model, enabled))
}

const CHECK_SYSTEM_PROMPT: &str = r#"You are a careful copy editor for essays.
Find real problems only: grammar errors, unclear phrasing, and concrete style issues.
Do not invent issues. Prefer precision over volume.
Return ONLY valid JSON (no markdown fences) with this shape:
{"issues":[{"type":"grammar"|"suggestion","text":"<exact quote from the essay>","suggestion":"<optional rewrite>","message":"<brief explanation>"}]}
Rules:
- "text" must be an exact contiguous substring copied from the essay.
- Keep quotes short (a phrase or sentence fragment), not whole paragraphs.
- type "grammar" for correctness; "suggestion" for style/clarity.
- If nothing needs fixing, return {"issues":[]}."#;

const PODCAST_NOTES_SYSTEM_PROMPT: &str = r#"You turn essays into clear podcast-host notes.
Return ONLY Markdown — no code fences, no preamble, no closing remarks.
Structure requirements:
1. Start with one H1 title for the notes (derived from the essay).
2. Follow with several sections. Each section MUST begin with an H2 heading (`## Section Title`).
3. Under every section, EVERY significant point MUST be a Markdown bullet (`- point`). Never write plain paragraphs for notes. Do not use numbered lists.
4. Keep bullets concise and speakable for a podcast host.
5. Do not invent facts that are not supported by the essay.
6. Prefer about 4–8 sections depending on essay length."#;

const HEADLINE_STYLE_PROMPT_DEFAULT: &str = r#"You write titles and subtitles (deks) for essays.
Read the essay and propose exactly 5 distinct title+subtitle pairs.
Rules:
- Title is the headline; subtitle sits under it as the dek.
- Stay faithful to the essay; do not invent facts, names, or claims.
- Make the five pairs meaningfully different from each other.
- Titles: about 4–12 words. Subtitles: one sentence.
- No wrapping quotation marks around the whole title or subtitle."#;

const HEADLINE_JSON_CONTRACT: &str = r#"Return ONLY valid JSON (no markdown fences, no preamble) with this shape:
{"pairs":[{"title":"<headline>","subtitle":"<one-sentence dek>"}]}"#;

const HEADLINE_SHOTS_INSTRUCTION: &str = r#"The user attached screenshots of headlines they like.
Study those examples for voice, rhythm, length, and framing.
Write 5 new title+subtitle pairs for THIS essay in that spirit.
Do not copy an example headline unless it genuinely fits this essay."#;

const MAX_HEADLINE_VISION_IMAGES: usize = 8;
const MAX_HEADLINE_VISION_BYTES: usize = 1_500_000;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HeadlineVisionImage {
    pub mime_type: String,
    pub data_base64: String,
}

fn compose_headline_system_prompt(style_prompt: Option<&str>) -> String {
    let style = style_prompt
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(HEADLINE_STYLE_PROMPT_DEFAULT);
    format!("{}\n\n{}", style, HEADLINE_JSON_CONTRACT)
}

fn compose_headline_from_shots_system_prompt(style_prompt: Option<&str>) -> String {
    let style = style_prompt
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(HEADLINE_STYLE_PROMPT_DEFAULT);
    format!(
        "{}\n\n{}\n\n{}",
        style, HEADLINE_SHOTS_INSTRUCTION, HEADLINE_JSON_CONTRACT
    )
}

fn normalize_vision_images(images: Vec<HeadlineVisionImage>) -> Result<Vec<HeadlineVisionImage>, String> {
    if images.is_empty() {
        return Err("Add screenshots in Research → Headlines first.".to_string());
    }
    let mut out = Vec::new();
    for image in images.into_iter().take(MAX_HEADLINE_VISION_IMAGES) {
        let mime = image.mime_type.trim().to_ascii_lowercase();
        let mime = match mime.as_str() {
            "image/jpg" => "image/jpeg".to_string(),
            "image/jpeg" | "image/png" | "image/gif" | "image/webp" => mime,
            _ => {
                return Err(format!(
                    "Unsupported screenshot type '{}'. Use PNG, JPEG, GIF, or WebP.",
                    image.mime_type
                ));
            }
        };
        let data = image
            .data_base64
            .chars()
            .filter(|c| !c.is_whitespace())
            .collect::<String>();
        if data.is_empty() {
            continue;
        }
        let approx_bytes = (data.len() * 3) / 4;
        if approx_bytes > MAX_HEADLINE_VISION_BYTES {
            return Err("A headline screenshot is too large to send to the model.".to_string());
        }
        out.push(HeadlineVisionImage {
            mime_type: mime,
            data_base64: data,
        });
    }
    if out.is_empty() {
        return Err("Add screenshots in Research → Headlines first.".to_string());
    }
    Ok(out)
}

fn openai_headline_user_content(essay: &str, images: &[HeadlineVisionImage]) -> Value {
    if images.is_empty() {
        return json!(format!("Essay to title:\n\n{}", essay));
    }
    let mut parts = vec![json!({
        "type": "text",
        "text": format!("Essay to title:\n\n{}", essay)
    })];
    for image in images {
        parts.push(json!({
            "type": "image_url",
            "image_url": {
                "url": format!("data:{};base64,{}", image.mime_type, image.data_base64)
            }
        }));
    }
    json!(parts)
}

fn anthropic_headline_user_content(essay: &str, images: &[HeadlineVisionImage]) -> Value {
    if images.is_empty() {
        return json!(format!("Essay to title:\n\n{}", essay));
    }
    let mut parts = Vec::new();
    for image in images {
        parts.push(json!({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": image.mime_type,
                "data": image.data_base64
            }
        }));
    }
    parts.push(json!({
        "type": "text",
        "text": format!("Essay to title:\n\n{}", essay)
    }));
    json!(parts)
}

fn strip_markdown_fences(raw: &str) -> String {
    let trimmed = raw.trim();
    let without_open = trimmed
        .strip_prefix("```markdown")
        .or_else(|| trimmed.strip_prefix("```md"))
        .or_else(|| trimmed.strip_prefix("```"))
        .unwrap_or(trimmed);
    without_open
        .strip_suffix("```")
        .unwrap_or(without_open)
        .trim()
        .to_string()
}

fn require_ai_config_for_generation(app: &AppHandle) -> Result<AiCheckConfig, String> {
    let config = read_config(app)?.ok_or_else(|| {
        "Add an API key in Settings → Sidebars first.".to_string()
    })?;
    if config.api_key.trim().is_empty() {
        return Err("Add an API key in Settings → Sidebars first.".to_string());
    }
    if !config.enabled {
        return Err("Enable AI check in Settings → Sidebars first.".to_string());
    }
    if config.model.trim().is_empty() {
        return Err("Select a model in Settings → Sidebars first.".to_string());
    }
    Ok(config)
}

fn parse_headline_pairs_from_model_text(raw: &str) -> Result<Vec<HeadlinePair>, String> {
    let value = extract_json_object(raw)?;
    let pairs_value = value
        .get("pairs")
        .cloned()
        .ok_or_else(|| "Model JSON missing \"pairs\" array.".to_string())?;
    let raw_pairs: Vec<HeadlinePair> = serde_json::from_value(pairs_value)
        .map_err(|e| format!("Could not parse headline pairs from model JSON: {}", e))?;
    let pairs: Vec<HeadlinePair> = raw_pairs
        .into_iter()
        .map(|p| HeadlinePair {
            title: p.title.trim().to_string(),
            subtitle: p.subtitle.trim().to_string(),
        })
        .filter(|p| !p.title.is_empty())
        .take(5)
        .collect();
    if pairs.is_empty() {
        return Err("The model returned no title suggestions.".to_string());
    }
    Ok(pairs)
}

fn extract_json_object(raw: &str) -> Result<Value, String> {
    let trimmed = raw.trim();
    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
        return Ok(v);
    }
    // Strip markdown fences if the model ignored instructions.
    let without_fence = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```"))
        .unwrap_or(trimmed);
    let without_fence = without_fence
        .strip_suffix("```")
        .unwrap_or(without_fence)
        .trim();
    if let Ok(v) = serde_json::from_str::<Value>(without_fence) {
        return Ok(v);
    }
    // Find first { … last }
    if let (Some(start), Some(end)) = (trimmed.find('{'), trimmed.rfind('}')) {
        if end > start {
            let slice = &trimmed[start..=end];
            if let Ok(v) = serde_json::from_str::<Value>(slice) {
                return Ok(v);
            }
        }
    }
    Err("Model response was not valid JSON.".to_string())
}

fn parse_issues_from_model_text(raw: &str) -> Result<Vec<AiCheckIssue>, String> {
    let value = extract_json_object(raw)?;
    let issues_value = value
        .get("issues")
        .cloned()
        .ok_or_else(|| "Model JSON missing \"issues\" array.".to_string())?;
    let mut issues: Vec<AiCheckIssue> = serde_json::from_value(issues_value)
        .map_err(|e| format!("Could not parse issues from model JSON: {}", e))?;
    for issue in &mut issues {
        let t = issue.r#type.trim().to_ascii_lowercase();
        issue.r#type = if t == "grammar" || t == "spelling" {
            t
        } else {
            "suggestion".to_string()
        };
        issue.text = issue.text.trim().to_string();
    }
    issues.retain(|i| !i.text.is_empty());
    Ok(issues)
}

fn run_openai_check(
    client: &Client,
    api_key: &str,
    model: &str,
    essay: &str,
) -> Result<ModelCheckResponse, String> {
    let body = json!({
        "model": model,
        "temperature": 0,
        "response_format": { "type": "json_object" },
        "messages": [
            { "role": "system", "content": CHECK_SYSTEM_PROMPT },
            { "role": "user", "content": format!("Essay to review:\n\n{}", essay) }
        ]
    });
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key.trim())
        .json(&body)
        .send()
        .map_err(|e| format!("OpenAI check request failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("Could not read OpenAI check response: {}", e))?;
    if !status.is_success() {
        return Err(format_api_error("OpenAI", status.as_u16(), &text));
    }
    let parsed: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Could not parse OpenAI check JSON: {}", e))?;
    let content = parsed
        .pointer("/choices/0/message/content")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "OpenAI response missing message content.".to_string())?;
    let input_tokens = parsed
        .pointer("/usage/prompt_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let output_tokens = parsed
        .pointer("/usage/completion_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    Ok(ModelCheckResponse {
        text: content,
        usage: AiCheckUsage {
            input_tokens,
            output_tokens,
        },
    })
}

fn run_anthropic_check(
    client: &Client,
    api_key: &str,
    model: &str,
    essay: &str,
) -> Result<ModelCheckResponse, String> {
    let body = json!({
        "model": model,
        "max_tokens": 4096,
        "system": CHECK_SYSTEM_PROMPT,
        "messages": [
            { "role": "user", "content": format!("Essay to review:\n\n{}", essay) }
        ]
    });
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key.trim())
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .map_err(|e| format!("Anthropic check request failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("Could not read Anthropic check response: {}", e))?;
    if !status.is_success() {
        return Err(format_api_error("Anthropic", status.as_u16(), &text));
    }
    let parsed: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Could not parse Anthropic check JSON: {}", e))?;
    let content = parsed
        .get("content")
        .and_then(|c| c.as_array())
        .ok_or_else(|| "Anthropic response missing content.".to_string())?;
    let mut out = String::new();
    for block in content {
        if block.get("type").and_then(|t| t.as_str()) == Some("text") {
            if let Some(t) = block.get("text").and_then(|t| t.as_str()) {
                out.push_str(t);
            }
        }
    }
    if out.is_empty() {
        return Err("Anthropic response had no text blocks.".to_string());
    }
    let input_tokens = parsed
        .pointer("/usage/input_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let output_tokens = parsed
        .pointer("/usage/output_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    Ok(ModelCheckResponse {
        text: out,
        usage: AiCheckUsage {
            input_tokens,
            output_tokens,
        },
    })
}

fn run_openai_test(client: &Client, api_key: &str, model: &str) -> Result<(), String> {
    let body = json!({
        "model": model,
        "temperature": 0,
        "max_tokens": 16,
        "messages": [
            { "role": "user", "content": "Reply with exactly: OK" }
        ]
    });
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key.trim())
        .json(&body)
        .send()
        .map_err(|e| format!("OpenAI test request failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("Could not read OpenAI test response: {}", e))?;
    if !status.is_success() {
        return Err(format_api_error("OpenAI", status.as_u16(), &text));
    }
    Ok(())
}

fn run_anthropic_test(client: &Client, api_key: &str, model: &str) -> Result<(), String> {
    let body = json!({
        "model": model,
        "max_tokens": 16,
        "messages": [
            { "role": "user", "content": "Reply with exactly: OK" }
        ]
    });
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key.trim())
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .map_err(|e| format!("Anthropic test request failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("Could not read Anthropic test response: {}", e))?;
    if !status.is_success() {
        return Err(format_api_error("Anthropic", status.as_u16(), &text));
    }
    Ok(())
}

#[tauri::command]
pub fn ai_check_get_config(app: AppHandle) -> Result<AiCheckConfigPublic, String> {
    Ok(to_public(read_config(&app)?.as_ref()))
}

#[tauri::command]
pub fn ai_check_save_config(
    app: AppHandle,
    input: AiCheckSaveInput,
) -> Result<AiCheckConfigPublic, String> {
    let existing = read_config(&app)?;
    let keep = input.keep_existing_key.unwrap_or(false);
    let api_key = {
        let trimmed = input.api_key.trim().to_string();
        if trimmed.is_empty() {
            if keep {
                existing
                    .as_ref()
                    .map(|c| c.api_key.clone())
                    .filter(|k| !k.trim().is_empty())
                    .ok_or_else(|| "No API key stored yet.".to_string())?
            } else {
                return Err("API key is required.".to_string());
            }
        } else {
            trimmed
        }
    };
    let provider = detect_provider_from_key(&api_key)?;
    let model = input
        .model
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| existing.as_ref().map(|c| c.model.clone()))
        .unwrap_or_default();
    let enabled = input
        .enabled
        .unwrap_or_else(|| existing.as_ref().map(|c| c.enabled).unwrap_or(false));
    let show_replace_suggestions = input.show_replace_suggestions.unwrap_or_else(|| {
        existing
            .as_ref()
            .map(|c| c.show_replace_suggestions)
            .unwrap_or(true)
    });

    let config = AiCheckConfig {
        api_key,
        provider,
        model,
        enabled,
        show_replace_suggestions,
    };
    write_config(&app, &config)?;
    Ok(to_public(Some(&config)))
}

#[tauri::command]
pub fn ai_check_set_enabled(app: AppHandle, enabled: bool) -> Result<AiCheckConfigPublic, String> {
    let mut config = read_config(&app)?.ok_or_else(|| {
        "Add an API key in Settings before enabling AI check.".to_string()
    })?;
    if config.api_key.trim().is_empty() {
        return Err("Add an API key in Settings before enabling AI check.".to_string());
    }
    config.enabled = enabled;
    write_config(&app, &config)?;
    Ok(to_public(Some(&config)))
}

#[tauri::command]
pub fn ai_check_set_show_replace_suggestions(
    app: AppHandle,
    show_replace_suggestions: bool,
) -> Result<AiCheckConfigPublic, String> {
    let mut config = read_config(&app)?.ok_or_else(|| {
        "Add an API key in Settings before changing AI check options.".to_string()
    })?;
    if config.api_key.trim().is_empty() {
        return Err("Add an API key in Settings before changing AI check options.".to_string());
    }
    config.show_replace_suggestions = show_replace_suggestions;
    write_config(&app, &config)?;
    Ok(to_public(Some(&config)))
}

#[tauri::command]
pub fn ai_check_clear_config(app: AppHandle) -> Result<AiCheckConfigPublic, String> {
    let path = config_path(&app)?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Could not clear AI check config: {}", e))?;
    }
    Ok(to_public(None))
}

#[tauri::command]
pub fn ai_check_detect_provider(api_key: String) -> Result<AiProvider, String> {
    detect_provider_from_key(&api_key)
}

#[tauri::command]
pub fn ai_check_list_models(
    app: AppHandle,
    api_key: Option<String>,
) -> Result<Vec<AiModelInfo>, String> {
    let (key, provider, _, _) = resolve_key_for_request(&app, api_key.as_deref())?;
    let client = http_client()?;
    match provider {
        AiProvider::Openai => list_openai_models(&client, &key),
        AiProvider::Anthropic => list_anthropic_models(&client, &key),
    }
}

#[tauri::command]
pub fn ai_check_test_connection(
    app: AppHandle,
    api_key: Option<String>,
    model: Option<String>,
) -> Result<String, String> {
    let (key, provider, stored_model, _) = resolve_key_for_request(&app, api_key.as_deref())?;
    let model = model
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(stored_model.as_str());
    if model.is_empty() {
        return Err("Select a model first.".to_string());
    }
    let client = http_client()?;
    match provider {
        AiProvider::Openai => run_openai_test(&client, &key, model)?,
        AiProvider::Anthropic => run_anthropic_test(&client, &key, model)?,
    }
    Ok(format!(
        "Connected to {} using {}.",
        provider.as_str(),
        model
    ))
}

#[tauri::command]
pub fn ai_check_run(app: AppHandle, essay: String) -> Result<AiCheckResult, String> {
    let config = read_config(&app)?.ok_or_else(|| {
        "Add an API key in Settings → Sidebars before running AI check.".to_string()
    })?;
    if config.api_key.trim().is_empty() {
        return Err("Add an API key in Settings → Sidebars before running AI check.".to_string());
    }
    if !config.enabled {
        return Err("Enable AI check in Settings → Sidebars first.".to_string());
    }
    if config.model.trim().is_empty() {
        return Err("Select a model in Settings → Sidebars first.".to_string());
    }
    let essay = essay.trim();
    if essay.is_empty() {
        return Err("Nothing to check — the document is empty.".to_string());
    }
    if essay.chars().count() > MAX_ESSAY_CHARS {
        return Err(format!(
            "Essay is too long for AI check (max {} characters).",
            MAX_ESSAY_CHARS
        ));
    }

    let client = http_client()?;
    let checked = match config.provider {
        AiProvider::Openai => run_openai_check(&client, &config.api_key, &config.model, essay)?,
        AiProvider::Anthropic => {
            run_anthropic_check(&client, &config.api_key, &config.model, essay)?
        }
    };
    let issues = parse_issues_from_model_text(&checked.text)?;
    Ok(AiCheckResult {
        issues,
        model: config.model,
        provider: config.provider,
        usage: checked.usage,
    })
}

fn run_openai_podcast_notes(
    client: &Client,
    api_key: &str,
    model: &str,
    essay: &str,
) -> Result<ModelCheckResponse, String> {
    let body = json!({
        "model": model,
        "temperature": 0.3,
        "messages": [
            { "role": "system", "content": PODCAST_NOTES_SYSTEM_PROMPT },
            { "role": "user", "content": format!("Essay to turn into podcast notes:\n\n{}", essay) }
        ]
    });
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key.trim())
        .json(&body)
        .send()
        .map_err(|e| format!("OpenAI podcast notes request failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("Could not read OpenAI podcast notes response: {}", e))?;
    if !status.is_success() {
        return Err(format_api_error("OpenAI", status.as_u16(), &text));
    }
    let parsed: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Could not parse OpenAI podcast notes JSON: {}", e))?;
    let content = parsed
        .pointer("/choices/0/message/content")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "OpenAI response missing message content.".to_string())?;
    let input_tokens = parsed
        .pointer("/usage/prompt_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let output_tokens = parsed
        .pointer("/usage/completion_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    Ok(ModelCheckResponse {
        text: content,
        usage: AiCheckUsage {
            input_tokens,
            output_tokens,
        },
    })
}

fn run_anthropic_podcast_notes(
    client: &Client,
    api_key: &str,
    model: &str,
    essay: &str,
) -> Result<ModelCheckResponse, String> {
    let body = json!({
        "model": model,
        "max_tokens": 8192,
        "system": PODCAST_NOTES_SYSTEM_PROMPT,
        "messages": [
            { "role": "user", "content": format!("Essay to turn into podcast notes:\n\n{}", essay) }
        ]
    });
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key.trim())
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .map_err(|e| format!("Anthropic podcast notes request failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("Could not read Anthropic podcast notes response: {}", e))?;
    if !status.is_success() {
        return Err(format_api_error("Anthropic", status.as_u16(), &text));
    }
    let parsed: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Could not parse Anthropic podcast notes JSON: {}", e))?;
    let content = parsed
        .get("content")
        .and_then(|c| c.as_array())
        .ok_or_else(|| "Anthropic response missing content.".to_string())?;
    let mut out = String::new();
    for block in content {
        if block.get("type").and_then(|t| t.as_str()) == Some("text") {
            if let Some(t) = block.get("text").and_then(|t| t.as_str()) {
                out.push_str(t);
            }
        }
    }
    if out.is_empty() {
        return Err("Anthropic response had no text blocks.".to_string());
    }
    let input_tokens = parsed
        .pointer("/usage/input_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let output_tokens = parsed
        .pointer("/usage/output_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    Ok(ModelCheckResponse {
        text: out,
        usage: AiCheckUsage {
            input_tokens,
            output_tokens,
        },
    })
}

#[tauri::command]
pub fn ai_check_podcast_notes(app: AppHandle, essay: String) -> Result<PodcastNotesResult, String> {
    let config = require_ai_config_for_generation(&app)?;
    let essay = essay.trim();
    if essay.is_empty() {
        return Err("Nothing to export — the document is empty.".to_string());
    }
    if essay.chars().count() > MAX_ESSAY_CHARS {
        return Err(format!(
            "Essay is too long for podcast notes (max {} characters).",
            MAX_ESSAY_CHARS
        ));
    }

    let client = http_client()?;
    let generated = match config.provider {
        AiProvider::Openai => {
            run_openai_podcast_notes(&client, &config.api_key, &config.model, essay)?
        }
        AiProvider::Anthropic => {
            run_anthropic_podcast_notes(&client, &config.api_key, &config.model, essay)?
        }
    };
    let markdown = strip_markdown_fences(&generated.text);
    if markdown.trim().is_empty() {
        return Err("The model returned empty podcast notes.".to_string());
    }
    Ok(PodcastNotesResult {
        markdown,
        model: config.model,
        provider: config.provider,
        usage: generated.usage,
    })
}

fn run_openai_headline_pairs(
    client: &Client,
    api_key: &str,
    model: &str,
    essay: &str,
    system_prompt: &str,
    images: &[HeadlineVisionImage],
) -> Result<ModelCheckResponse, String> {
    let body = json!({
        "model": model,
        "temperature": 0.7,
        "response_format": { "type": "json_object" },
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": openai_headline_user_content(essay, images) }
        ]
    });
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key.trim())
        .json(&body)
        .send()
        .map_err(|e| format!("OpenAI headline request failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("Could not read OpenAI headline response: {}", e))?;
    if !status.is_success() {
        return Err(format_api_error("OpenAI", status.as_u16(), &text));
    }
    let parsed: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Could not parse OpenAI headline JSON: {}", e))?;
    let content = parsed
        .pointer("/choices/0/message/content")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "OpenAI response missing message content.".to_string())?;
    let input_tokens = parsed
        .pointer("/usage/prompt_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let output_tokens = parsed
        .pointer("/usage/completion_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    Ok(ModelCheckResponse {
        text: content,
        usage: AiCheckUsage {
            input_tokens,
            output_tokens,
        },
    })
}

fn run_anthropic_headline_pairs(
    client: &Client,
    api_key: &str,
    model: &str,
    essay: &str,
    system_prompt: &str,
    images: &[HeadlineVisionImage],
) -> Result<ModelCheckResponse, String> {
    let body = json!({
        "model": model,
        "max_tokens": 2048,
        "temperature": 0.7,
        "system": system_prompt,
        "messages": [
            { "role": "user", "content": anthropic_headline_user_content(essay, images) }
        ]
    });
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key.trim())
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .map_err(|e| format!("Anthropic headline request failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .map_err(|e| format!("Could not read Anthropic headline response: {}", e))?;
    if !status.is_success() {
        return Err(format_api_error("Anthropic", status.as_u16(), &text));
    }
    let parsed: Value = serde_json::from_str(&text)
        .map_err(|e| format!("Could not parse Anthropic headline JSON: {}", e))?;
    let content = parsed
        .get("content")
        .and_then(|c| c.as_array())
        .ok_or_else(|| "Anthropic response missing content.".to_string())?;
    let mut out = String::new();
    for block in content {
        if block.get("type").and_then(|t| t.as_str()) == Some("text") {
            if let Some(t) = block.get("text").and_then(|t| t.as_str()) {
                out.push_str(t);
            }
        }
    }
    if out.is_empty() {
        return Err("Anthropic response had no text blocks.".to_string());
    }
    let input_tokens = parsed
        .pointer("/usage/input_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let output_tokens = parsed
        .pointer("/usage/output_tokens")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    Ok(ModelCheckResponse {
        text: out,
        usage: AiCheckUsage {
            input_tokens,
            output_tokens,
        },
    })
}

#[tauri::command]
pub fn ai_check_headline_pairs(
    app: AppHandle,
    essay: String,
    style_prompt: Option<String>,
) -> Result<HeadlinePairsResult, String> {
    let config = require_ai_config_for_generation(&app)?;
    let essay = essay.trim();
    if essay.is_empty() {
        return Err("Nothing to title — the document is empty.".to_string());
    }
    if essay.chars().count() > MAX_ESSAY_CHARS {
        return Err(format!(
            "Essay is too long for headline suggestions (max {} characters).",
            MAX_ESSAY_CHARS
        ));
    }

    let system_prompt = compose_headline_system_prompt(style_prompt.as_deref());
    let client = http_client()?;
    let generated = match config.provider {
        AiProvider::Openai => run_openai_headline_pairs(
            &client,
            &config.api_key,
            &config.model,
            essay,
            &system_prompt,
            &[],
        )?,
        AiProvider::Anthropic => run_anthropic_headline_pairs(
            &client,
            &config.api_key,
            &config.model,
            essay,
            &system_prompt,
            &[],
        )?,
    };
    let pairs = parse_headline_pairs_from_model_text(&generated.text)?;
    Ok(HeadlinePairsResult {
        pairs,
        model: config.model,
        provider: config.provider,
        usage: generated.usage,
    })
}

#[tauri::command]
pub fn ai_check_headline_pairs_from_shots(
    app: AppHandle,
    essay: String,
    style_prompt: Option<String>,
    images: Vec<HeadlineVisionImage>,
) -> Result<HeadlinePairsResult, String> {
    let config = require_ai_config_for_generation(&app)?;
    let essay = essay.trim();
    if essay.is_empty() {
        return Err("Nothing to title — the document is empty.".to_string());
    }
    if essay.chars().count() > MAX_ESSAY_CHARS {
        return Err(format!(
            "Essay is too long for headline suggestions (max {} characters).",
            MAX_ESSAY_CHARS
        ));
    }

    let images = normalize_vision_images(images)?;
    let system_prompt = compose_headline_from_shots_system_prompt(style_prompt.as_deref());
    let client = http_client()?;
    let generated = match config.provider {
        AiProvider::Openai => run_openai_headline_pairs(
            &client,
            &config.api_key,
            &config.model,
            essay,
            &system_prompt,
            &images,
        )?,
        AiProvider::Anthropic => run_anthropic_headline_pairs(
            &client,
            &config.api_key,
            &config.model,
            essay,
            &system_prompt,
            &images,
        )?,
    };
    let pairs = parse_headline_pairs_from_model_text(&generated.text)?;
    Ok(HeadlinePairsResult {
        pairs,
        model: config.model,
        provider: config.provider,
        usage: generated.usage,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_openai_and_anthropic_keys() {
        assert_eq!(
            detect_provider_from_key("sk-proj-abc").unwrap(),
            AiProvider::Openai
        );
        assert_eq!(
            detect_provider_from_key("sk-ant-api03-xyz").unwrap(),
            AiProvider::Anthropic
        );
        assert!(detect_provider_from_key("not-a-key").is_err());
    }

    #[test]
    fn parses_issues_json() {
        let raw = r#"{"issues":[{"type":"grammar","text":"was went","suggestion":"went","message":"tense"}]}"#;
        let issues = parse_issues_from_model_text(raw).unwrap();
        assert_eq!(issues.len(), 1);
        assert_eq!(issues[0].r#type, "grammar");
        assert_eq!(issues[0].text, "was went");
    }

    #[test]
    fn parses_headline_pairs_json() {
        let raw = r#"```json
{"pairs":[
  {"title":" First ","subtitle":" A dek. "},
  {"title":"Second","subtitle":"Another dek."},
  {"title":"","subtitle":"skip me"},
  {"title":"Third","subtitle":"Third dek."},
  {"title":"Fourth","subtitle":"Fourth dek."},
  {"title":"Fifth","subtitle":"Fifth dek."},
  {"title":"Sixth","subtitle":"should be dropped"}
]}
```"#;
        let pairs = parse_headline_pairs_from_model_text(raw).unwrap();
        assert_eq!(pairs.len(), 5);
        assert_eq!(pairs[0].title, "First");
        assert_eq!(pairs[0].subtitle, "A dek.");
        assert_eq!(pairs[4].title, "Fifth");
    }

    #[test]
    fn rejects_headline_pairs_without_titles() {
        let raw = r#"{"pairs":[{"title":"","subtitle":"nope"}]}"#;
        assert!(parse_headline_pairs_from_model_text(raw).is_err());
    }

    #[test]
    fn composes_custom_style_with_json_contract() {
        let prompt = compose_headline_system_prompt(Some("Punchy news headlines."));
        assert!(prompt.starts_with("Punchy news headlines."));
        assert!(prompt.contains("\"pairs\""));
        let fallback = compose_headline_system_prompt(Some("  "));
        assert!(fallback.starts_with("You write titles and subtitles"));
        assert!(fallback.contains("\"pairs\""));
    }

    #[test]
    fn composes_shots_prompt_with_style_examples() {
        let prompt = compose_headline_from_shots_system_prompt(Some("Punchy news headlines."));
        assert!(prompt.starts_with("Punchy news headlines."));
        assert!(prompt.contains("screenshots of headlines they like"));
        assert!(prompt.contains("\"pairs\""));
    }

    #[test]
    fn rejects_empty_vision_images() {
        assert!(normalize_vision_images(vec![]).is_err());
    }

    #[test]
    fn openai_user_content_is_text_without_images() {
        let content = openai_headline_user_content("Hello essay", &[]);
        assert_eq!(content, json!("Essay to title:\n\nHello essay"));
    }

    #[test]
    fn openai_user_content_includes_data_urls() {
        let images = vec![HeadlineVisionImage {
            mime_type: "image/jpeg".to_string(),
            data_base64: "abc".to_string(),
        }];
        let content = openai_headline_user_content("Hello essay", &images);
        assert_eq!(content[1]["image_url"]["url"], "data:image/jpeg;base64,abc");
    }
}
