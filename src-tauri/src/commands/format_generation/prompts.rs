use super::types::FormatInspirationExample;

const INSPIRATION_PREAMBLE: &str = "Below are examples the user has saved in Harvy Collect. Use these as inspiration for structure and style only. Do not copy them. Do not reuse their specific claims unless those claims also appear in the essay.";

fn inspiration_rules(has_examples: bool) -> &'static str {
    if has_examples {
        r#"
- Use the Harvy Collect examples to infer style, rhythm, structure, pacing, and framing.
- Do not directly copy or lightly paraphrase the Collect examples.
- Do not introduce ideas that appear only in the Collect examples and not in the essay."#
    } else {
        ""
    }
}

fn collection_system_prompt(
    platform: &str,
    role: &str,
    count: i64,
    item_prefix: &str,
    title_example: &str,
    output_rules: &str,
    has_examples: bool,
) -> String {
    format!(
        r#"{role}

Return ONLY valid JSON in this exact shape:
{{
  "platform": "{platform}",
  "type": "collection",
  "title": "{title_example}",
  "items": [
    {{
      "id": "{item_prefix}-1",
      "text": "Output text here...",
      "status": "draft",
      "favorite": false
    }}
  ]
}}

Rules:
- Generate exactly {count} outputs.
- Base outputs ONLY on the provided essay. Do not invent unrelated ideas.
- Preserve the author's voice from the essay.
- Use ids "{item_prefix}-1" through "{item_prefix}-{count}".
- Set status to "draft" and favorite to false for every item.{inspiration}
{output_rules}
- Return JSON only. No markdown fences or explanations."#,
        role = role,
        platform = platform,
        title_example = title_example,
        item_prefix = item_prefix,
        count = count,
        inspiration = inspiration_rules(has_examples),
        output_rules = output_rules,
    )
}

pub fn user_prompt_with_inspiration(essay_text: &str, examples: &[FormatInspirationExample]) -> String {
    let trimmed = essay_text.trim();
    if examples.is_empty() {
        return format!("Essay:\n\n{}", trimmed);
    }

    let mut block = String::new();
    for (index, example) in examples
        .iter()
        .filter(|e| !e.preview.trim().is_empty())
        .enumerate()
    {
        block.push_str(&format!(
            "{}. [{}] {}\n",
            index + 1,
            example.example_type,
            example.preview.trim()
        ));
    }

    format!(
        "Essay:\n\n{}\n\n{}\n\n{}",
        trimmed,
        INSPIRATION_PREAMBLE,
        block.trim_end()
    )
}

pub fn build_tweet_prompts(count: i64, has_examples: bool) -> (String, String) {
    let system = collection_system_prompt(
        "twitter",
        "You convert essays into standalone tweets and short notes.",
        count,
        "tweet",
        &format!("Tweets / Notes — {count} generated"),
        r#"
- Each tweet must stand alone and make sense without the essay.
- Avoid hashtags unless strongly relevant.
- Avoid generic motivational filler.
- Keep each tweet concise (aim for under 280 characters)."#,
        has_examples,
    );
    (system, String::new())
}

pub fn build_youtube_prompts(count: i64, has_examples: bool) -> (String, String) {
    let system = collection_system_prompt(
        "youtube",
        "You convert essays into YouTube video script segments or outline beats.",
        count,
        "youtube",
        &format!("YouTube — {count} generated"),
        r#"
- Each output should work as a distinct video script segment, hook, or structured beat.
- Favor spoken, conversational language suitable for video narration.
- Include a clear opening hook where appropriate."#,
        has_examples,
    );
    (system, String::new())
}

pub fn build_substack_prompts(count: i64, has_examples: bool) -> (String, String) {
    let system = collection_system_prompt(
        "substack",
        "You convert essays into newsletter-ready Substack post drafts or article sections.",
        count,
        "substack",
        &format!("Substack — {count} generated"),
        r#"
- Each output should read like a newsletter section or standalone Substack post derived from the essay.
- Use clear headings or strong opening lines when helpful.
- Favor readable paragraphs over tweet-style fragments."#,
        has_examples,
    );
    (system, String::new())
}

pub fn build_instagram_prompts(count: i64, has_examples: bool) -> (String, String) {
    let system = collection_system_prompt(
        "instagram",
        "You convert essays into Instagram caption-style posts.",
        count,
        "instagram",
        &format!("Instagram — {count} generated"),
        r#"
- Each output should work as a standalone Instagram caption.
- Front-load the hook in the first line.
- Keep captions scannable with short paragraphs or line breaks."#,
        has_examples,
    );
    (system, String::new())
}

pub fn build_tiktok_prompts(count: i64, has_examples: bool) -> (String, String) {
    let system = collection_system_prompt(
        "tiktok",
        "You convert essays into TikTok short-form video scripts.",
        count,
        "tiktok",
        &format!("TikTok — {count} generated"),
        r#"
- Each output should work as a short spoken script for a TikTok video.
- Open with a strong hook in the first sentence.
- Keep language punchy, conversational, and concise."#,
        has_examples,
    );
    (system, String::new())
}

pub fn build_linkedin_prompts(count: i64, has_examples: bool) -> (String, String) {
    let system = collection_system_prompt(
        "linkedin",
        "You convert essays into professional LinkedIn posts.",
        count,
        "linkedin",
        &format!("LinkedIn — {count} generated"),
        r#"
- Each output should work as a standalone LinkedIn post.
- Lead with a professional hook or insight.
- Use short paragraphs and line breaks for readability."#,
        has_examples,
    );
    (system, String::new())
}

pub fn build_platform_system_prompt(platform: &str, count: i64, has_examples: bool) -> String {
    match platform {
        "x" => build_tweet_prompts(count, has_examples).0,
        "youtube" => build_youtube_prompts(count, has_examples).0,
        "substack" => build_substack_prompts(count, has_examples).0,
        "instagram" => build_instagram_prompts(count, has_examples).0,
        "tiktok" => build_tiktok_prompts(count, has_examples).0,
        "linkedin" => build_linkedin_prompts(count, has_examples).0,
        _ => String::new(),
    }
}
