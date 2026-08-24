use reqwest::blocking::Client;
use serde::Serialize;

const USER_AGENT: &str = "Harvy/0.1 (Medium public archive)";
const MAX_POSTS: usize = 100;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediumPostResult {
    pub id: String,
    pub title: String,
    pub preview: String,
    pub post_date: String,
    pub canonical_url: String,
    pub claps: u32,
    pub responses: u32,
    pub creator_name: String,
    pub handle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator_photo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_image: Option<String>,
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| format!("Could not build HTTP client: {}", e))
}

fn parse_medium_username(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Enter a Medium profile or publication URL.".to_string());
    }
    if trimmed.starts_with('@') {
        return Ok(trimmed.trim_start_matches('@').to_string());
    }
    if let Some(idx) = trimmed.find("@") {
        let after = &trimmed[idx + 1..];
        let username = after
            .split(&['/', '?', '#'][..])
            .next()
            .unwrap_or(after)
            .trim();
        if !username.is_empty() {
            return Ok(username.to_string());
        }
    }
    let path = trimmed
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_start_matches("www.")
        .trim_start_matches("medium.com/")
        .trim_matches('/');
    let username = path
        .split(&['/', '?', '#'][..])
        .next()
        .unwrap_or(path)
        .trim();
    if username.is_empty() {
        return Err("Could not parse Medium username from URL.".to_string());
    }
    Ok(username.to_string())
}

fn ms_to_iso(ms: i64) -> String {
    let secs = ms / 1000;
    let nanos = ((ms % 1000) * 1_000_000) as u32;
    let format = time::format_description::well_known::Rfc3339;
    match time::OffsetDateTime::from_unix_timestamp(secs) {
        Ok(dt) => dt
            .replace_nanosecond(nanos)
            .unwrap_or(dt)
            .format(&format)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string()),
        Err(_) => time::OffsetDateTime::UNIX_EPOCH
            .format(&format)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string()),
    }
}

fn medium_image_url(image_id: &str) -> Option<String> {
    if image_id.is_empty() {
        return None;
    }
    Some(format!("https://cdn-images-1.medium.com/max/800/{}", image_id))
}

fn item_to_result(
    post: &serde_json::Value,
    profile: &(String, String, Option<String>),
) -> Option<MediumPostResult> {
    let post_id = post
        .get("postId")
        .or_else(|| post.get("id"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| {
            post.get("uniqueSlug")
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })?;
    let slug = post
        .get("uniqueSlug")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| post_id.clone());
    let published_ms = post
        .get("latestPublishedAt")
        .or_else(|| post.get("firstPublishedAt"))
        .or_else(|| post.get("createdAt"))
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let title = post
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Untitled")
        .trim()
        .to_string();
    let preview = post
        .pointer("/virtuals/subtitle")
        .and_then(|v| v.as_str())
        .unwrap_or(&title)
        .trim()
        .to_string();
    let handle = post
        .pointer("/creator/username")
        .and_then(|v| v.as_str())
        .unwrap_or(&profile.1)
        .to_string();
    let creator_name = post
        .pointer("/creator/name")
        .and_then(|v| v.as_str())
        .unwrap_or(&profile.0)
        .to_string();
    let claps = post
        .get("clapCount")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let responses = post
        .pointer("/virtuals/responsesCreatedCount")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let cover_image = post
        .pointer("/virtuals/previewImageUrl")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| {
            post.pointer("/virtuals/previewImage/imageId")
                .and_then(|v| v.as_str())
                .and_then(medium_image_url)
        });
    let creator_photo = post
        .pointer("/creator/imageId")
        .and_then(|v| v.as_str())
        .and_then(medium_image_url)
        .or(profile.2.clone());

    Some(MediumPostResult {
        id: post_id,
        title: title.clone(),
        preview: if preview.is_empty() { title } else { preview },
        post_date: ms_to_iso(published_ms as i64),
        canonical_url: format!("https://medium.com/@{}/{}", handle, slug),
        claps,
        responses,
        creator_name,
        handle: format!("@{}", handle),
        creator_photo_url: creator_photo,
        cover_image,
    })
}

#[tauri::command]
pub fn fetch_medium_posts(source_url: String) -> Result<Vec<MediumPostResult>, String> {
    let username = parse_medium_username(&source_url)?;
    let client = http_client()?;
    let profile_url = format!("https://medium.com/@{}/latest?format=json", username);
    let response = client
        .get(&profile_url)
        .header("Accept", "application/json")
        .send()
        .map_err(|e| format!("Medium request failed: {}", e))?;
    if !response.status().is_success() {
        return Err(format!(
            "Medium request failed ({}) for @{}.",
            response.status(),
            username
        ));
    }
    let payload: serde_json::Value = response
        .json()
        .map_err(|e| format!("Could not parse Medium response: {}", e))?;
    let user = payload.pointer("/payload/user");
    let profile_name = user
        .and_then(|u| u.get("name"))
        .and_then(|v| v.as_str())
        .unwrap_or(&username)
        .to_string();
    let profile_handle = user
        .and_then(|u| u.get("username"))
        .and_then(|v| v.as_str())
        .unwrap_or(&username)
        .to_string();
    let profile_photo = user
        .and_then(|u| u.get("imageId"))
        .and_then(|v| v.as_str())
        .and_then(medium_image_url);
    let profile = (profile_name, profile_handle, profile_photo);

    let posts_by_id = payload
        .pointer("/payload/references/Post")
        .and_then(|v| v.as_object());
    let stream_items = payload
        .pointer("/payload/streamItems")
        .and_then(|v| v.as_array());

    let mut results: Vec<MediumPostResult> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    if let (Some(posts), Some(items)) = (posts_by_id, stream_items) {
        for item in items {
            let item_type = item.get("itemType").and_then(|v| v.as_str()).unwrap_or("post");
            if item_type != "post" {
                continue;
            }
            let post_id = item.get("postId").and_then(|v| v.as_str()).unwrap_or("");
            if post_id.is_empty() {
                continue;
            }
            if let Some(post) = posts.get(post_id) {
                if let Some(row) = item_to_result(post, &profile) {
                    if seen.insert(row.id.clone()) {
                        results.push(row);
                        if results.len() >= MAX_POSTS {
                            break;
                        }
                    }
                }
            }
        }
    }

    if results.is_empty() {
        if let Some(posts) = posts_by_id {
            for post in posts.values() {
                if let Some(row) = item_to_result(post, &profile) {
                    if seen.insert(row.id.clone()) {
                        results.push(row);
                        if results.len() >= MAX_POSTS {
                            break;
                        }
                    }
                }
            }
        }
    }

    results.sort_by(|a, b| b.post_date.cmp(&a.post_date));
    Ok(results)
}
