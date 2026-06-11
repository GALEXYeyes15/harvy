use super::types::TwitterFormatCollection;
use reqwest::blocking::Client;
use serde::Serialize;
use serde_json::Value;

const OPENAI_RESPONSES_URL: &str = "https://api.openai.com/v1/responses";

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

pub fn generate_twitter_collection(
    essay_text: &str,
    target_count: i64,
) -> Result<TwitterFormatCollection, String> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| "OPENAI_API_KEY is not configured".to_string())?
        .trim()
        .to_string();
    if api_key.is_empty() {
        return Err("OPENAI_API_KEY is not configured".to_string());
    }

    let count = target_count.clamp(1, super::types::MAX_TWITTER_FORMAT_COUNT);
    let system_prompt = twitter_system_prompt(count);
    let user_prompt = format!("Essay:\n\n{}", essay_text.trim());

    let body = ResponsesRequest {
        model: "gpt-4o",
        input: vec![
            ResponseInputMessage {
                role: "system",
                content: &system_prompt,
            },
            ResponseInputMessage {
                role: "user",
                content: &user_prompt,
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

    normalize_twitter_collection(parsed, count)
}

fn twitter_system_prompt(count: i64) -> String {
    format!(
        r#"You convert essays into standalone tweets for X (Twitter).

Return ONLY valid JSON in this exact shape:
{{
  "platform": "twitter",
  "type": "collection",
  "title": "Tweets — {count} generated",
  "items": [
    {{
      "id": "tweet-1",
      "text": "Tweet text here...",
      "status": "draft",
      "favorite": false
    }}
  ]
}}

Rules:
- Generate exactly {count} tweets.
- Base tweets ONLY on the provided essay. Do not invent unrelated ideas.
- Each tweet must stand alone and make sense without the essay.
- Preserve the author's voice where possible.
- Avoid hashtags unless strongly relevant.
- Avoid generic motivational filler.
- Keep each tweet concise (aim for under 280 characters).
- Use ids "tweet-1" through "tweet-{count}".
- Set status to "draft" and favorite to false for every item.
- Return JSON only. No markdown fences or explanations."#
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

fn normalize_twitter_collection(raw: Value, target_count: i64) -> Result<TwitterFormatCollection, String> {
    let platform = raw
        .get("platform")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    let collection_type = raw
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    if platform != "twitter" || collection_type != "collection" {
        return Err("Unexpected format generation platform".to_string());
    }

    let items_value = raw
        .get("items")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Format generation response missing items".to_string())?;

    let mut items = Vec::new();
    for (index, item) in items_value.iter().enumerate() {
        let text = item
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .trim()
            .to_string();
        if text.is_empty() {
            continue;
        }
        let id = item
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| format!("tweet-{}", index + 1));
        items.push(super::types::TwitterFormatItem {
            id,
            text,
            status: "draft".to_string(),
            favorite: false,
        });
    }

    if items.is_empty() {
        return Err("Format generation returned no tweets".to_string());
    }

    let count = items.len().min(target_count as usize);
    items.truncate(count);

    let title = raw
        .get("title")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("Tweets — {} generated", items.len()));

    Ok(TwitterFormatCollection::new(title, items))
}
