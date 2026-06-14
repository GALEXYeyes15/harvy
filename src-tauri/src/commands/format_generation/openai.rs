use super::types::{FormatCollection, FormatInspirationExample, FormatOutputItem};
use reqwest::blocking::Client;
use serde::Serialize;
use serde_json::Value;

const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";

const INSPIRATION_PREAMBLE: &str = "Below are examples the user has saved in Harvy Collect. Use these as inspiration for structure and style only. Do not copy them. Do not reuse their specific claims unless those claims also appear in the essay.";

#[derive(Serialize)]
struct ResponsesRequest<'a> {
    model: &'a str,
    input: Vec<ResponseInputMessage<'a>>,
    text: ResponsesTextConfig,
}

#[derive(Serialize)]
struct ResponseInputMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Serialize)]
struct ResponsesTextConfig {
    format: ResponsesTextFormat,
}

#[derive(Serialize)]
struct ResponsesTextFormat {
    #[serde(rename = "type")]
    format_type: &'static str,
}

pub fn generate_tweets_notes_collection(
    essay_text: &str,
    target_count: i64,
    inspiration_examples: &[FormatInspirationExample],
) -> Result<FormatCollection, String> {
    let count = target_count.clamp(1, super::types::MAX_TWITTER_FORMAT_COUNT);
    let has_examples = !inspiration_examples.is_empty();
    let system_prompt = tweets_notes_system_prompt(count, has_examples);
    let user_prompt = tweets_notes_user_prompt(essay_text, inspiration_examples);
    generate_category_collection(
        &system_prompt,
        &user_prompt,
        "tweets_notes",
        &["tweets_notes", "tweets-notes", "twitter", "x"],
        count,
        "tweets-notes",
        &format!("Tweets / Notes — {count} generated"),
    )
}

/// @deprecated Use generate_tweets_notes_collection
pub fn generate_twitter_collection(
    essay_text: &str,
    target_count: i64,
    inspiration_examples: &[FormatInspirationExample],
) -> Result<FormatCollection, String> {
    generate_tweets_notes_collection(essay_text, target_count, inspiration_examples)
}

pub fn generate_category_collection(
    system_prompt: &str,
    user_prompt: &str,
    expected_category: &str,
    valid_categories: &[&str],
    target_count: i64,
    item_prefix: &str,
    default_title: &str,
) -> Result<FormatCollection, String> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY is not configured".to_string())?
        .trim()
        .to_string();
    if api_key.is_empty() {
        return Err("OPENAI_API_KEY is not configured".to_string());
    }

    let count = target_count.clamp(1, super::types::MAX_FORMAT_OUTPUT_COUNT);

    let body = ResponsesRequest {
        model: "gpt-4o",
        input: vec![
            ResponseInputMessage {
                role: "system",
                content: system_prompt,
            },
            ResponseInputMessage {
                role: "user",
                content: user_prompt,
            },
        ],
        text: ResponsesTextConfig {
            format: ResponsesTextFormat {
                format_type: "json_object",
            },
        },
    };

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("Could not create HTTP client: {}", e))?;

    let response = client
        .post(OPENAI_RESPONSES_URL)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    let status = response.status();
    let response_text = response
        .text()
        .map_err(|e| format!("Could not read OpenAI response: {}", e))?;

    if !status.is_success() {
        return Err(format!("OpenAI error ({}): {}", status, response_text));
    }

    let payload: Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("OpenAI returned invalid JSON envelope: {}", e))?;

    let output = extract_output_text(&payload).ok_or_else(|| "OpenAI returned an empty response".to_string())?;

    let parsed: Value = serde_json::from_str(&output)
        .map_err(|_| "OpenAI returned invalid JSON".to_string())?;

    normalize_category_collection(
        parsed,
        expected_category,
        valid_categories,
        count,
        item_prefix,
        default_title,
    )
}

/// @deprecated Use generate_category_collection
pub fn generate_platform_collection(
    system_prompt: &str,
    user_prompt: &str,
    valid_platforms: &[&str],
    target_count: i64,
    item_prefix: &str,
    default_title: &str,
) -> Result<FormatCollection, String> {
    generate_category_collection(
        system_prompt,
        user_prompt,
        "tweets_notes",
        valid_platforms,
        target_count,
        item_prefix,
        default_title,
    )
}

fn tweets_notes_system_prompt(count: i64, has_inspiration_examples: bool) -> String {
    let inspiration_rules = if has_inspiration_examples {
        r#"
- Use the Harvy Collect examples to infer style, rhythm, structure, punchiness, pacing, and framing.
- Do not directly copy or lightly paraphrase the Collect examples.
- Do not introduce ideas that appear only in the Collect examples and not in the essay."#
    } else {
        ""
    };

    format!(
        r#"You convert essays into concise standalone notes and tweets.

Return ONLY valid JSON in this exact shape:
{{
  "category": "tweets_notes",
  "type": "collection",
  "title": "Tweets / Notes — {count} generated",
  "items": [
    {{
      "id": "tweets-notes-1",
      "title": null,
      "content": "Note or tweet text here...",
      "status": "draft",
      "favorite": false
    }}
  ]
}}

Rules:
- Generate exactly {count} outputs.
- Base outputs ONLY on the provided essay. Do not invent unrelated ideas.
- Each output should work as a social post, note fragment, or reusable idea.
- Preserve the author's voice from the essay.
- Keep each output concise (aim for under 280 characters when tweet-like).
- Avoid hashtags unless strongly relevant.
- Avoid generic motivational filler.
- Use ids "tweets-notes-1" through "tweets-notes-{count}".
- Set title to null and status to "draft" with favorite false for every item.{inspiration_rules}
- Return JSON only. No markdown fences or explanations."#
    )
}

fn tweets_notes_user_prompt(essay_text: &str, inspiration_examples: &[FormatInspirationExample]) -> String {
    let trimmed_essay = essay_text.trim();
    if inspiration_examples.is_empty() {
        return format!("Essay:\n\n{}", trimmed_essay);
    }

    let mut examples_block = String::new();
    for (index, example) in inspiration_examples
        .iter()
        .filter(|example| !example.preview.trim().is_empty())
        .enumerate()
    {
        examples_block.push_str(&format!(
            "{}. [{}] {}\n",
            index + 1,
            example.example_type,
            example.preview.trim()
        ));
    }

    format!(
        "Essay:\n\n{}\n\n{}\n\n{}",
        trimmed_essay,
        INSPIRATION_PREAMBLE,
        examples_block.trim_end()
    )
}

fn extract_output_text(payload: &Value) -> Option<String> {
    if let Some(text) = payload.get("output_text").and_then(|v| v.as_str()) {
        if !text.trim().is_empty() {
            return Some(text.to_string());
        }
    }

    let output = payload.get("output")?.as_array()?;
    let content = output.first()?.get("content")?.as_array()?;
    let text = content.first()?.get("text")?.as_str()?;
    if text.trim().is_empty() {
        return None;
    }
    Some(text.to_string())
}

fn read_item_content(item: &Value) -> String {
    if let Some(content) = item.get("content").and_then(|v| v.as_str()) {
        let trimmed = content.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    if let Some(text) = item.get("text").and_then(|v| v.as_str()) {
        return text.trim().to_string();
    }
    String::new()
}

fn normalize_category_collection(
    raw: Value,
    expected_category: &str,
    valid_categories: &[&str],
    target_count: i64,
    item_prefix: &str,
    default_title: &str,
) -> Result<FormatCollection, String> {
    let category = raw
        .get("category")
        .and_then(|v| v.as_str())
        .or_else(|| raw.get("platform").and_then(|v| v.as_str()))
        .unwrap_or_default();
    let collection_type = raw
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    if collection_type != "collection" || !valid_categories.contains(&category) {
        return Err("Unexpected format generation category".to_string());
    }

    let items_value = raw
        .get("items")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Format generation response missing items".to_string())?;

    let mut items = Vec::new();
    for (index, item) in items_value.iter().enumerate() {
        let content = read_item_content(item);
        if content.is_empty() {
            continue;
        }
        let id = item
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| format!("{}-{}", item_prefix, index + 1));
        let title = item
            .get("title")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        items.push(FormatOutputItem {
            id,
            title,
            content,
            status: "draft".to_string(),
            favorite: false,
        });
    }

    if items.is_empty() {
        return Err("Format generation returned no outputs".to_string());
    }

    let count = items.len().min(target_count as usize);
    items.truncate(count);

    let title = raw
        .get("title")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| default_title.replace("{count}", &items.len().to_string()));

    Ok(FormatCollection::new(expected_category, title, items))
}
