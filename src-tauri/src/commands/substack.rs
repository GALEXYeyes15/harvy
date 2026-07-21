use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

const USER_AGENT: &str = "Harvy/0.1 (Substack public archive)";
const ARCHIVE_PAGE_SIZE: usize = 50;
const ARCHIVE_MAX_POSTS: usize = 200;
const NOTES_PAGE_SIZE: usize = 20;
const NOTES_MAX_ITEMS: usize = 200;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubstackPostResult {
    pub id: String,
    pub title: String,
    pub preview: String,
    pub post_date: String,
    pub canonical_url: String,
    pub likes: u32,
    pub comments: u32,
    pub restacks: u32,
    pub cover_image: Option<String>,
    pub creator_name: String,
    pub handle: String,
    pub subdomain: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator_photo_url: Option<String>,
    /// `"newsletter"` or `"note"`.
    pub kind: String,
    /// Substack Note ProseMirror JSON (notes only).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body_json: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct PublicProfile {
    id: i64,
    name: String,
    handle: String,
    #[serde(default)]
    photo_url: Option<String>,
    #[serde(default, rename = "publicationUsers")]
    publication_users: Vec<PublicationUser>,
}

#[derive(Debug, Deserialize)]
struct PublicationUser {
    #[serde(default)]
    public: bool,
    #[serde(default, rename = "is_primary")]
    is_primary: bool,
    publication: Option<Publication>,
}

#[derive(Debug, Deserialize)]
struct Publication {
    subdomain: String,
}

#[derive(Debug, Deserialize)]
struct ArchivePost {
    id: i64,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    subtitle: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    truncated_body_text: Option<String>,
    #[serde(default)]
    post_date: Option<String>,
    #[serde(default)]
    canonical_url: Option<String>,
    #[serde(default)]
    cover_image: Option<String>,
    #[serde(default)]
    reactions: Option<serde_json::Map<String, serde_json::Value>>,
    #[serde(default)]
    restacks: Option<u32>,
    #[serde(default)]
    comment_count: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct NotesFeedResponse {
    #[serde(default)]
    items: Vec<NotesFeedItem>,
    #[serde(default, rename = "nextCursor")]
    next_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NotesFeedItem {
    #[serde(default)]
    context: Option<NotesContext>,
    #[serde(default)]
    comment: Option<NoteComment>,
    #[serde(default)]
    entity_key: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NotesContext {
    #[serde(default)]
    #[serde(rename = "type")]
    context_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct NoteComment {
    id: i64,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    body_json: Option<serde_json::Value>,
    #[serde(default)]
    date: Option<String>,
    #[serde(default)]
    reaction_count: Option<u32>,
    #[serde(default)]
    reactions: Option<serde_json::Map<String, serde_json::Value>>,
    #[serde(default)]
    restacks: Option<u32>,
    /// Reply count on Notes.
    #[serde(default)]
    children_count: Option<u32>,
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .user_agent(USER_AGENT)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))
}

/// Extract a Substack handle from a profile URL, publication URL, or bare handle.
pub fn parse_substack_handle(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Enter a Substack profile or publication URL.".to_string());
    }

    let without_at = trimmed.trim_start_matches('@');
    if !without_at.contains('/') && !without_at.contains('.') {
        let handle = without_at.to_ascii_lowercase();
        if handle.is_empty() {
            return Err("Enter a Substack profile or publication URL.".to_string());
        }
        return Ok(handle);
    }

    let normalized = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };

    let without_scheme = normalized
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let (host_and_path, _) = without_scheme
        .split_once('?')
        .unwrap_or((without_scheme, ""));
    let (host, path) = host_and_path.split_once('/').unwrap_or((host_and_path, ""));
    let host = host.to_ascii_lowercase();

    if host == "substack.com" || host == "www.substack.com" {
        let first = path
            .split('/')
            .find(|segment| !segment.is_empty())
            .unwrap_or("");
        let handle = first.trim_start_matches('@').to_ascii_lowercase();
        if !handle.is_empty() {
            return Ok(handle);
        }
        return Err("Use a profile link like https://substack.com/@yourhandle.".to_string());
    }

    if let Some(subdomain) = host.strip_suffix(".substack.com") {
        let handle = subdomain.to_ascii_lowercase();
        if !handle.is_empty() && handle != "www" {
            return Ok(handle);
        }
    }

    Err("Only public Substack profile or publication links are supported.".to_string())
}

fn likes_from_reactions(reactions: &Option<serde_json::Map<String, serde_json::Value>>) -> u32 {
    let Some(map) = reactions else {
        return 0;
    };
    for key in ["❤", "❤️", "like", "♥"] {
        if let Some(value) = map.get(key) {
            if let Some(n) = value.as_u64() {
                return n as u32;
            }
            if let Some(n) = value.as_i64() {
                return n.max(0) as u32;
            }
        }
    }
    0
}

fn pick_publication_subdomain(profile: &PublicProfile) -> Option<String> {
    let primary = profile
        .publication_users
        .iter()
        .find(|pu| pu.is_primary && pu.public)
        .or_else(|| profile.publication_users.iter().find(|pu| pu.public))
        .or_else(|| profile.publication_users.first());

    primary
        .and_then(|pu| pu.publication.as_ref())
        .map(|p| p.subdomain.clone())
        .filter(|s| !s.is_empty())
}

fn fetch_public_profile(client: &Client, handle: &str) -> Result<PublicProfile, String> {
    let url = format!("https://substack.com/api/v1/user/{handle}/public_profile");
    let response = client
        .get(&url)
        .send()
        .map_err(|e| format!("Could not reach Substack: {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Substack profile not found for @{handle} ({}).",
            response.status()
        ));
    }
    response
        .json::<PublicProfile>()
        .map_err(|e| format!("Could not read Substack profile: {e}"))
}

fn fetch_archive_page(
    client: &Client,
    subdomain: &str,
    offset: usize,
) -> Result<Vec<ArchivePost>, String> {
    let url = format!(
        "https://{subdomain}.substack.com/api/v1/archive?sort=new&search=&offset={offset}&limit={ARCHIVE_PAGE_SIZE}"
    );
    let response = client
        .get(&url)
        .send()
        .map_err(|e| format!("Could not reach Substack archive: {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Substack archive request failed ({}).",
            response.status()
        ));
    }
    response
        .json::<Vec<ArchivePost>>()
        .map_err(|e| format!("Could not read Substack archive: {e}"))
}

fn fetch_notes_page(
    client: &Client,
    user_id: i64,
    cursor: Option<&str>,
) -> Result<NotesFeedResponse, String> {
    let mut url = format!(
        "https://substack.com/api/v1/reader/feed/profile/{user_id}?types%5B%5D=note&limit={NOTES_PAGE_SIZE}"
    );
    if let Some(cursor) = cursor {
        url.push_str("&cursor=");
        url.push_str(&urlencoding_encode(cursor));
    }
    let response = client
        .get(&url)
        .send()
        .map_err(|e| format!("Could not reach Substack Notes: {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Substack Notes request failed ({}).",
            response.status()
        ));
    }
    response
        .json::<NotesFeedResponse>()
        .map_err(|e| format!("Could not read Substack Notes: {e}"))
}

/// Minimal URL-encoding for cursor query values.
fn urlencoding_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

fn note_title_from_body(body: &str) -> String {
    let first_line = body
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("Note");
    let mut title = first_line.chars().take(80).collect::<String>();
    if first_line.chars().count() > 80 {
        title.push('…');
    }
    title
}

fn map_archive_post(
    post: ArchivePost,
    creator_name: &str,
    handle: &str,
    subdomain: &str,
    creator_photo_url: Option<&str>,
) -> Option<SubstackPostResult> {
    let title = post.title.unwrap_or_default().trim().to_string();
    let preview = post
        .subtitle
        .or(post.description)
        .or(post.truncated_body_text)
        .unwrap_or_default()
        .trim()
        .to_string();
    let post_date = post.post_date.filter(|d| !d.is_empty())?;
    let canonical_url = post
        .canonical_url
        .filter(|u| !u.is_empty())
        .unwrap_or_else(|| format!("https://{subdomain}.substack.com"));
    let cover = post
        .cover_image
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    Some(SubstackPostResult {
        id: format!("newsletter-{}", post.id),
        title: if title.is_empty() {
            "Untitled".to_string()
        } else {
            title
        },
        preview,
        post_date,
        canonical_url,
        likes: likes_from_reactions(&post.reactions),
        comments: post.comment_count.unwrap_or(0),
        restacks: post.restacks.unwrap_or(0),
        cover_image: cover,
        creator_name: creator_name.to_string(),
        handle: format!("@{handle}"),
        subdomain: subdomain.to_string(),
        creator_photo_url: creator_photo_url.map(|s| s.to_string()),
        kind: "newsletter".to_string(),
        body_json: None,
    })
}

fn map_note_item(
    item: NotesFeedItem,
    creator_name: &str,
    handle: &str,
    subdomain: &str,
    creator_photo_url: Option<&str>,
) -> Option<SubstackPostResult> {
    let context_type = item
        .context
        .as_ref()
        .and_then(|c| c.context_type.as_deref())
        .unwrap_or("");
    if context_type != "note" {
        return None;
    }
    let comment = item.comment?;
    let body = comment.body.unwrap_or_default().trim().to_string();
    if body.is_empty() {
        return None;
    }
    let post_date = comment.date.filter(|d| !d.is_empty())?;
    let likes = comment
        .reaction_count
        .unwrap_or_else(|| likes_from_reactions(&comment.reactions));
    let entity = item
        .entity_key
        .filter(|k| !k.is_empty())
        .unwrap_or_else(|| format!("c-{}", comment.id));
    let body_json = comment.body_json.filter(|value| value.is_object());

    Some(SubstackPostResult {
        id: format!("note-{}", comment.id),
        title: note_title_from_body(&body),
        preview: body,
        post_date,
        canonical_url: format!("https://substack.com/@{handle}/note/{entity}"),
        likes,
        comments: comment.children_count.unwrap_or(0),
        restacks: comment.restacks.unwrap_or(0),
        cover_image: None,
        creator_name: creator_name.to_string(),
        handle: format!("@{handle}"),
        subdomain: subdomain.to_string(),
        creator_photo_url: creator_photo_url.map(|s| s.to_string()),
        kind: "note".to_string(),
        body_json,
    })
}

fn fetch_newsletter_posts(
    client: &Client,
    subdomain: &str,
    creator_name: &str,
    creator_handle: &str,
    creator_photo_url: Option<&str>,
) -> Result<Vec<SubstackPostResult>, String> {
    let mut posts = Vec::new();
    let mut offset = 0usize;

    while posts.len() < ARCHIVE_MAX_POSTS {
        let page = fetch_archive_page(client, subdomain, offset)?;
        if page.is_empty() {
            break;
        }
        let page_len = page.len();
        for post in page {
            if let Some(mapped) = map_archive_post(
                post,
                creator_name,
                creator_handle,
                subdomain,
                creator_photo_url,
            ) {
                posts.push(mapped);
                if posts.len() >= ARCHIVE_MAX_POSTS {
                    break;
                }
            }
        }
        if page_len < ARCHIVE_PAGE_SIZE {
            break;
        }
        offset += page_len;
    }

    Ok(posts)
}

fn fetch_note_posts(
    client: &Client,
    user_id: i64,
    creator_name: &str,
    creator_handle: &str,
    subdomain: &str,
    creator_photo_url: Option<&str>,
) -> Result<Vec<SubstackPostResult>, String> {
    let mut notes = Vec::new();
    let mut cursor: Option<String> = None;

    while notes.len() < NOTES_MAX_ITEMS {
        let page = fetch_notes_page(client, user_id, cursor.as_deref())?;
        if page.items.is_empty() {
            break;
        }
        for item in page.items {
            if let Some(mapped) = map_note_item(
                item,
                creator_name,
                creator_handle,
                subdomain,
                creator_photo_url,
            ) {
                notes.push(mapped);
                if notes.len() >= NOTES_MAX_ITEMS {
                    break;
                }
            }
        }
        match page.next_cursor {
            Some(next) if !next.is_empty() => cursor = Some(next),
            _ => break,
        }
    }

    Ok(notes)
}

pub fn fetch_substack_posts_impl(account_url: &str) -> Result<Vec<SubstackPostResult>, String> {
    let handle = parse_substack_handle(account_url)?;
    let client = http_client()?;
    let profile = fetch_public_profile(&client, &handle)?;
    let creator_name = profile.name.trim().to_string();
    let creator_handle = profile.handle.to_ascii_lowercase();
    let subdomain = pick_publication_subdomain(&profile).unwrap_or_else(|| creator_handle.clone());
    let creator_photo_url = profile
        .photo_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty());

    let mut posts = Vec::new();

    if let Some(pub_subdomain) = pick_publication_subdomain(&profile) {
        posts.extend(fetch_newsletter_posts(
            &client,
            &pub_subdomain,
            &creator_name,
            &creator_handle,
            creator_photo_url,
        )?);
    }

    posts.extend(fetch_note_posts(
        &client,
        profile.id,
        &creator_name,
        &creator_handle,
        &subdomain,
        creator_photo_url,
    )?);

    if posts.is_empty() {
        return Err(format!(
            "No public posts or Notes found for @{creator_handle}."
        ));
    }

    posts.sort_by(|a, b| b.post_date.cmp(&a.post_date));
    Ok(posts)
}

#[tauri::command]
pub fn fetch_substack_posts(account_url: String) -> Result<Vec<SubstackPostResult>, String> {
    fetch_substack_posts_impl(&account_url)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubstackCommentResult {
    pub id: String,
    pub author_name: String,
    pub handle: String,
    pub body: String,
    pub date: String,
    pub likes: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub photo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body_json: Option<serde_json::Value>,
    pub replies: Vec<SubstackCommentResult>,
}

#[derive(Debug, Deserialize)]
struct PostCommentsResponse {
    #[serde(default)]
    comments: Vec<ApiCommentNode>,
}

#[derive(Debug, Deserialize)]
struct ApiCommentNode {
    id: i64,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    body_json: Option<serde_json::Value>,
    #[serde(default)]
    date: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    handle: Option<String>,
    #[serde(default)]
    photo_url: Option<String>,
    #[serde(default)]
    reaction_count: Option<u32>,
    #[serde(default)]
    reactions: Option<serde_json::Map<String, serde_json::Value>>,
    #[serde(default)]
    deleted: Option<bool>,
    #[serde(default)]
    children: Option<Vec<ApiCommentNode>>,
}

#[derive(Debug, Deserialize)]
struct NoteRepliesResponse {
    #[serde(default, rename = "commentBranches")]
    comment_branches: Vec<NoteCommentBranch>,
}

#[derive(Debug, Deserialize)]
struct NoteCommentBranch {
    #[serde(default)]
    comment: Option<ApiCommentNode>,
    #[serde(default, rename = "descendantComments")]
    descendant_comments: Option<Vec<NoteDescendant>>,
}

#[derive(Debug, Deserialize)]
struct NoteDescendant {
    #[serde(default)]
    comment: Option<ApiCommentNode>,
}

fn map_api_comment(node: ApiCommentNode) -> Option<SubstackCommentResult> {
    if node.deleted.unwrap_or(false) {
        return None;
    }
    let body = node.body.unwrap_or_default().trim().to_string();
    if body.is_empty() {
        return None;
    }
    let likes = node
        .reaction_count
        .unwrap_or_else(|| likes_from_reactions(&node.reactions));
    let replies = node
        .children
        .unwrap_or_default()
        .into_iter()
        .filter_map(map_api_comment)
        .collect();
    Some(SubstackCommentResult {
        id: node.id.to_string(),
        author_name: node
            .name
            .unwrap_or_else(|| "Anonymous".to_string())
            .trim()
            .to_string(),
        handle: {
            let h = node.handle.unwrap_or_default().trim().to_string();
            if h.is_empty() {
                String::new()
            } else if h.starts_with('@') {
                h
            } else {
                format!("@{h}")
            }
        },
        body,
        date: node.date.unwrap_or_default(),
        likes,
        photo_url: node
            .photo_url
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty()),
        body_json: node.body_json.filter(|v| v.is_object()),
        replies,
    })
}

fn fetch_newsletter_comments(
    client: &Client,
    subdomain: &str,
    post_id: i64,
) -> Result<Vec<SubstackCommentResult>, String> {
    let url = format!("https://{subdomain}.substack.com/api/v1/post/{post_id}/comments");
    let response = client
        .get(&url)
        .send()
        .map_err(|e| format!("Substack comments request failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Substack comments request failed ({})",
            response.status()
        ));
    }
    let payload: PostCommentsResponse = response
        .json()
        .map_err(|e| format!("Could not parse Substack comments: {e}"))?;
    Ok(payload
        .comments
        .into_iter()
        .filter_map(map_api_comment)
        .collect())
}

fn fetch_note_comments(
    client: &Client,
    note_id: i64,
) -> Result<Vec<SubstackCommentResult>, String> {
    let url = format!("https://substack.com/api/v1/reader/comment/{note_id}/replies");
    let response = client
        .get(&url)
        .send()
        .map_err(|e| format!("Substack note replies request failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!(
            "Substack note replies request failed ({})",
            response.status()
        ));
    }
    let payload: NoteRepliesResponse = response
        .json()
        .map_err(|e| format!("Could not parse Substack note replies: {e}"))?;

    let mut out = Vec::new();
    for branch in payload.comment_branches {
        let Some(mut top) = branch.comment.and_then(map_api_comment) else {
            continue;
        };
        let nested = branch
            .descendant_comments
            .unwrap_or_default()
            .into_iter()
            .filter_map(|d| d.comment.and_then(map_api_comment))
            .collect::<Vec<_>>();
        top.replies.extend(nested);
        out.push(top);
    }
    Ok(out)
}

pub fn fetch_substack_comments_impl(
    kind: &str,
    source_id: i64,
    subdomain: &str,
) -> Result<Vec<SubstackCommentResult>, String> {
    let client = http_client()?;
    match kind {
        "note" => fetch_note_comments(&client, source_id),
        "newsletter" | "post" => {
            let sub = subdomain.trim();
            if sub.is_empty() {
                return Err("Missing publication subdomain for post comments.".to_string());
            }
            fetch_newsletter_comments(&client, sub, source_id)
        }
        _ => Err(format!("Unknown content kind: {kind}")),
    }
}

#[tauri::command]
pub fn fetch_substack_comments(
    kind: String,
    source_id: i64,
    subdomain: String,
) -> Result<Vec<SubstackCommentResult>, String> {
    fetch_substack_comments_impl(&kind, source_id, &subdomain)
}

#[cfg(test)]
mod tests {
    use super::parse_substack_handle;

    #[test]
    fn parses_profile_urls() {
        assert_eq!(
            parse_substack_handle("https://substack.com/@alexlacy").unwrap(),
            "alexlacy"
        );
        assert_eq!(
            parse_substack_handle("https://alexlacy.substack.com").unwrap(),
            "alexlacy"
        );
        assert_eq!(parse_substack_handle("@alexlacy").unwrap(), "alexlacy");
    }
}
