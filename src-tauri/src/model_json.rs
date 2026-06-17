use serde_json::Value;

fn preview_text(text: &str, max_len: usize) -> String {
    let normalized: String = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.chars().count() <= max_len {
        return normalized;
    }
    let truncated: String = normalized.chars().take(max_len).collect();
    format!("{truncated}…")
}

fn strip_markdown_fence(text: &str) -> Option<String> {
    let trimmed = text.trim();
    if !trimmed.starts_with("```") {
        return None;
    }

    let without_open = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```JSON"))
        .or_else(|| trimmed.strip_prefix("```"))
        .unwrap_or(trimmed)
        .trim_start();

    let body = without_open
        .strip_suffix("```")
        .map(str::trim)
        .unwrap_or(without_open);
    if body.is_empty() {
        None
    } else {
        Some(body.to_string())
    }
}

fn outer_json_object_bounds(text: &str) -> Option<(usize, usize)> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if end > start {
        Some((start, end))
    } else {
        None
    }
}

pub fn extract_json_candidates(text: &str) -> Vec<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }

    let mut candidates = vec![trimmed.to_string()];
    if let Some(fenced) = strip_markdown_fence(trimmed) {
        candidates.push(fenced);
    }
    if let Some((start, end)) = outer_json_object_bounds(trimmed) {
        candidates.push(trimmed[start..=end].to_string());
    }

    candidates.sort_by_key(|candidate| std::cmp::Reverse(candidate.len()));
    candidates.dedup();
    candidates
}

pub fn parse_model_json_value(text: &str, context: &str) -> Result<Value, String> {
    let candidates = extract_json_candidates(text);
    let mut last_error: Option<String> = None;

    for candidate in candidates {
        match serde_json::from_str::<Value>(&candidate) {
            Ok(value) => return Ok(value),
            Err(error) => last_error = Some(error.to_string()),
        }
    }

    eprintln!("RAW ANTHROPIC RESPONSE ({context})\n{text}");
    let detail = last_error.unwrap_or_else(|| "unknown parse error".to_string());
    Err(format!(
        "Anthropic returned invalid JSON: {detail} (preview: {})",
        preview_text(text, 800)
    ))
}

#[cfg(test)]
mod tests {
    use super::{extract_json_candidates, parse_model_json_value};

    #[test]
    fn parses_json_wrapped_in_markdown_fence() {
        let raw = r#"```json
{"category":"mid_form_post","type":"collection","title":"t","items":[{"id":"mid-form-post-1","title":null,"content":"Hello","status":"draft","favorite":false}]}
```"#;
        let value = parse_model_json_value(raw, "test").expect("parse fenced json");
        assert_eq!(value.get("type").and_then(|v| v.as_str()), Some("collection"));
    }

    #[test]
    fn extracts_multiple_candidates() {
        let candidates = extract_json_candidates("Here is output:\n```json\n{\"a\":1}\n```");
        assert!(candidates.iter().any(|c| c.contains("\"a\":1")));
    }
}
