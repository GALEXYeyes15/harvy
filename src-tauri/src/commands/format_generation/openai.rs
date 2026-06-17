use super::types::{FormatCollection, FormatInspirationExample, FormatOutputItem};
use crate::ai_config::{
    ANTHROPIC_API_KEY_ENV, ANTHROPIC_API_VERSION, ANTHROPIC_MESSAGES_URL, DEFAULT_MAX_OUTPUT_TOKENS,
    DEFAULT_MODEL,
};
use crate::model_json::parse_model_json_value;
use reqwest::blocking::Client;
use serde::Serialize;
use serde_json::Value;

const INSPIRATION_PREAMBLE: &str = "Below are examples the user has saved in Harvy Collect. Use these as inspiration for structure and style only. Do not copy them. Do not reuse their specific claims unless those claims also appear in the essay.";

#[derive(Serialize)]
struct AnthropicRequest<'a> {
    model: &'a str,
    max_tokens: u32,
    system: &'a str,
    messages: Vec<AnthropicMessage<'a>>,
}

#[derive(Serialize)]
struct AnthropicMessage<'a> {
    role: &'a str,
    content: &'a str,
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

pub fn generate_mid_form_post_collection(
    essay_text: &str,
    target_count: i64,
    inspiration_examples: &[FormatInspirationExample],
) -> Result<FormatCollection, String> {
    let count = target_count.clamp(1, super::types::MAX_FORMAT_OUTPUT_COUNT);
    let has_examples = !inspiration_examples.is_empty();
    let system_prompt = mid_form_post_system_prompt(count, has_examples);
    let user_prompt = tweets_notes_user_prompt(essay_text, inspiration_examples);
    generate_category_collection(
        &system_prompt,
        &user_prompt,
        "mid_form_post",
        &["mid_form_post", "mid-form-post"],
        count,
        "mid-form-post",
        &format!("Mid Form Post — {count} generated"),
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
    let api_key = std::env::var(ANTHROPIC_API_KEY_ENV)
        .map_err(|_| format!("{ANTHROPIC_API_KEY_ENV} is not configured"))?
        .trim()
        .to_string();
    #[cfg(debug_assertions)]
    eprintln!(
        "[harvy] generate_category_collection: cwd={:?}, {} present={}, empty={}",
        std::env::current_dir(),
        ANTHROPIC_API_KEY_ENV,
        std::env::var(ANTHROPIC_API_KEY_ENV).is_ok(),
        api_key.is_empty()
    );
    if api_key.is_empty() {
        return Err(format!("{ANTHROPIC_API_KEY_ENV} is not configured"));
    }

    let count = target_count.clamp(1, super::types::MAX_FORMAT_OUTPUT_COUNT);

    let body = AnthropicRequest {
        model: DEFAULT_MODEL,
        max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
        system: system_prompt,
        messages: vec![AnthropicMessage {
            role: "user",
            content: user_prompt,
        }],
    };

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("Could not create HTTP client: {}", e))?;

    let response = client
        .post(ANTHROPIC_MESSAGES_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_API_VERSION)
        .json(&body)
        .send()
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    let status = response.status();
    let response_text = response
        .text()
        .map_err(|e| format!("Could not read Anthropic response: {}", e))?;

    if !status.is_success() {
        return Err(format!("Anthropic error ({}): {}", status, response_text));
    }

    #[cfg(debug_assertions)]
    {
        eprintln!("[harvy] ANTHROPIC SYSTEM PROMPT:\n{system_prompt}");
        eprintln!("[harvy] ANTHROPIC USER PROMPT:\n{user_prompt}");
        eprintln!("[harvy] RAW ANTHROPIC ENVELOPE:\n{response_text}");
    }

    let payload: Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("Anthropic returned invalid JSON envelope: {}", e))?;

    let output = extract_output_text(&payload).ok_or_else(|| "Anthropic returned an empty response".to_string())?;

    #[cfg(debug_assertions)]
    eprintln!("[harvy] RAW ANTHROPIC MODEL TEXT:\n{output}");

    let parsed = parse_model_json_value(&output, "format_generation")?;

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

fn mid_form_post_system_prompt(count: i64, has_inspiration_examples: bool) -> String {
    let inspiration_rules = if has_inspiration_examples {
        r#"
- Collect examples may inform structure only when consistent with the essay's voice. The essay's style always takes priority over Collect examples.
- Do not directly copy or lightly paraphrase the Collect examples.
- Do not introduce ideas that appear only in the Collect examples and not in the essay."#
    } else {
        ""
    };

    format!(
        r#"You compress essays into mid-form posts (150–250 words) suitable for LinkedIn, Instagram captions, Threads, Facebook, and similar platforms — without changing how the author sounds.

Return ONLY valid JSON in this exact shape:
{{
  "category": "mid_form_post",
  "type": "collection",
  "title": "Mid Form Post — {count} generated",
  "items": [
    {{
      "id": "mid-form-post-1",
      "title": null,
      "content": "Mid-form post text here...",
      "status": "draft",
      "favorite": false
    }}
  ]
}}

Rules:
- Generate exactly {count} outputs.
- Base outputs ONLY on the provided essay. Do not invent unrelated ideas.
- Each output should focus on a single idea, lesson, story, or insight from the essay.
- Aim for 150–250 words per output.
- You are not rewriting the author's voice. You are compressing the author's voice.
- Create a 150–250 word excerpt that could plausibly have appeared inside the original essay.
- A reader familiar with the original essay should feel that the same person wrote both pieces.
- The post should read as a condensed version of the source, not a social-media-optimized rewrite.

VOICE PRESERVATION:
- Match sentence length patterns from the source (long paragraphs if the source uses them; short sentences if the source uses them).
- Match punctuation style. Do not introduce em dashes, semicolons, excessive colons, or other punctuation habits absent from the source.
- Match pacing and rhythm. Do not turn reflective writing into motivational writing.
- Match tone: analytical stays analytical; story-driven stays story-driven; technical stays technical; personal stays personal.
- Preserve the author's vocabulary whenever possible.
- Preserve the author's level of certainty. Do not make claims stronger than the source or add urgency or emotional intensity.

AVOID unless already present in the source:
- Generic social media patterns ("Here's what I learned", "The lesson is...", "If you've ever...", "This changed everything", "Most people don't realize...", and similar engagement clichés).
- Hook-heavy openings, motivational phrasing, generic audience callouts, or punchier cadence than the original author.
- Hashtags unless the essay explicitly requests them.
- Use ids "mid-form-post-1" through "mid-form-post-{count}".
- Set title to null and status to "draft" with favorite false for every item.{inspiration_rules}
- Return JSON only. No markdown fences or explanations."#
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
    if let Some(content) = payload.get("content").and_then(|v| v.as_array()) {
        for block in content {
            let block_type = block.get("type").and_then(|v| v.as_str());
            if block_type == Some("text") {
                if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                    if !text.trim().is_empty() {
                        return Some(text.to_string());
                    }
                }
            }
        }
    }

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
