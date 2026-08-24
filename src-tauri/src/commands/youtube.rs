use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

const MAX_VIDEOS: usize = 50;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeVideoResult {
    pub id: String,
    pub title: String,
    pub preview: String,
    pub post_date: String,
    pub canonical_url: String,
    pub views: u32,
    pub likes: u32,
    pub comments: u32,
    pub creator_name: String,
    pub handle: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub creator_photo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_image: Option<String>,
}

fn youtube_api_key() -> Result<String, String> {
    let key = std::env::var("YOUTUBE_API_KEY").unwrap_or_default();
    if key.trim().is_empty() {
        return Err("Add YOUTUBE_API_KEY to .env.local to fetch YouTube outliers.".to_string());
    }
    Ok(key.trim().to_string())
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .build()
        .map_err(|e| format!("Could not build HTTP client: {}", e))
}

fn parse_youtube_channel_input(raw: &str) -> Result<(Option<String>, Option<String>), String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Enter a YouTube channel URL.".to_string());
    }
    if trimmed.starts_with("UC") && trimmed.len() >= 22 {
        return Ok((Some(trimmed.to_string()), None));
    }
    if let Some(idx) = trimmed.find('@') {
        let handle = trimmed[idx + 1..]
            .split(&['/', '?', '#'][..])
            .next()
            .unwrap_or("")
            .trim();
        if !handle.is_empty() {
            return Ok((None, Some(handle.to_string())));
        }
    }
    if trimmed.contains("/channel/") {
        if let Some(id) = trimmed.split("/channel/").nth(1) {
            let channel_id = id.split(&['/', '?', '#'][..]).next().unwrap_or("").trim();
            if !channel_id.is_empty() {
                return Ok((Some(channel_id.to_string()), None));
            }
        }
    }
    Err("Use a youtube.com/@handle or /channel/… URL.".to_string())
}

#[derive(Debug, Deserialize)]
struct ChannelListResponse {
    items: Option<Vec<ChannelItem>>,
}

#[derive(Debug, Deserialize)]
struct ChannelItem {
    id: Option<String>,
    snippet: Option<ChannelSnippet>,
    content_details: Option<ChannelContentDetails>,
}

#[derive(Debug, Deserialize)]
struct ChannelSnippet {
    title: Option<String>,
    custom_url: Option<String>,
    thumbnails: Option<Thumbnails>,
}

#[derive(Debug, Deserialize)]
struct ChannelContentDetails {
    related_playlists: Option<RelatedPlaylists>,
}

#[derive(Debug, Deserialize)]
struct RelatedPlaylists {
    uploads: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Thumbnails {
    high: Option<Thumbnail>,
    medium: Option<Thumbnail>,
    #[serde(rename = "default")]
    default_thumb: Option<Thumbnail>,
}

#[derive(Debug, Deserialize)]
struct Thumbnail {
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PlaylistItemsResponse {
    items: Option<Vec<PlaylistItem>>,
}

#[derive(Debug, Deserialize)]
struct PlaylistItem {
    content_details: Option<PlaylistContentDetails>,
}

#[derive(Debug, Deserialize)]
struct PlaylistContentDetails {
    video_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VideosListResponse {
    items: Option<Vec<VideoItem>>,
}

#[derive(Debug, Deserialize)]
struct VideoItem {
    id: Option<String>,
    snippet: Option<VideoSnippet>,
    statistics: Option<VideoStatistics>,
}

#[derive(Debug, Deserialize)]
struct VideoSnippet {
    title: Option<String>,
    description: Option<String>,
    published_at: Option<String>,
    thumbnails: Option<Thumbnails>,
}

#[derive(Debug, Deserialize)]
struct VideoStatistics {
    view_count: Option<String>,
    like_count: Option<String>,
    comment_count: Option<String>,
}

fn youtube_get<T: for<'de> Deserialize<'de>>(
    client: &Client,
    key: &str,
    path: &str,
    params: &[(&str, String)],
) -> Result<T, String> {
    let query: Vec<(String, String)> = params
        .iter()
        .map(|(k, v)| (k.to_string(), v.clone()))
        .chain(std::iter::once(("key".to_string(), key.to_string())))
        .collect();
    let url = format!("https://www.googleapis.com/youtube/v3/{}", path);
    let response = client
        .get(&url)
        .query(&query)
        .send()
        .map_err(|e| format!("YouTube API request failed: {}", e))?;
    if !response.status().is_success() {
        let body = response.text().unwrap_or_default();
        return Err(if body.trim().is_empty() {
            "YouTube API request failed.".to_string()
        } else {
            body
        });
    }
    response
        .json()
        .map_err(|e| format!("Could not parse YouTube response: {}", e))
}

fn parse_count(raw: Option<&String>) -> u32 {
    raw.and_then(|v| v.parse::<u32>().ok()).unwrap_or(0)
}

fn thumb_url(thumbnails: &Thumbnails) -> Option<String> {
    thumbnails
        .high
        .as_ref()
        .or(thumbnails.medium.as_ref())
        .or(thumbnails.default_thumb.as_ref())
        .and_then(|t| t.url.clone())
}

#[tauri::command]
pub fn fetch_youtube_videos(source_url: String) -> Result<Vec<YoutubeVideoResult>, String> {
    let key = youtube_api_key()?;
    let client = http_client()?;
    let (channel_id, handle) = parse_youtube_channel_input(&source_url)?;

    let channel_response: ChannelListResponse = if let Some(id) = channel_id {
        youtube_get(
            &client,
            &key,
            "channels",
            &[("part", "snippet,contentDetails".to_string()), ("id", id)],
        )?
    } else if let Some(h) = handle {
        youtube_get(
            &client,
            &key,
            "channels",
            &[
                ("part", "snippet,contentDetails".to_string()),
                ("forHandle", h),
            ],
        )?
    } else {
        return Err("Could not resolve YouTube channel.".to_string());
    };

    let channel = channel_response
        .items
        .and_then(|items| items.into_iter().next())
        .ok_or_else(|| "YouTube channel not found.".to_string())?;
    let channel_id = channel
        .id
        .ok_or_else(|| "YouTube channel not found.".to_string())?;
    let uploads = channel
        .content_details
        .and_then(|d| d.related_playlists)
        .and_then(|p| p.uploads)
        .ok_or_else(|| "YouTube channel has no uploads.".to_string())?;
    let title = channel
        .snippet
        .as_ref()
        .and_then(|s| s.title.clone())
        .unwrap_or_else(|| channel_id.clone());
    let custom_url = channel
        .snippet
        .as_ref()
        .and_then(|s| s.custom_url.clone())
        .unwrap_or_else(|| format!("@{}", channel_id));
    let handle_label = if custom_url.starts_with('@') {
        custom_url
    } else {
        format!("@{}", custom_url)
    };
    let photo = channel
        .snippet
        .as_ref()
        .and_then(|s| s.thumbnails.as_ref())
        .and_then(thumb_url);

    let playlist: PlaylistItemsResponse = youtube_get(
        &client,
        &key,
        "playlistItems",
        &[
            ("part", "contentDetails".to_string()),
            ("playlistId", uploads),
            ("maxResults", MAX_VIDEOS.to_string()),
        ],
    )?;

    let video_ids: Vec<String> = playlist
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| item.content_details.and_then(|d| d.video_id))
        .collect();
    if video_ids.is_empty() {
        return Ok(Vec::new());
    }

    let videos: VideosListResponse = youtube_get(
        &client,
        &key,
        "videos",
        &[
            ("part", "snippet,statistics".to_string()),
            ("id", video_ids.join(",")),
        ],
    )?;

    let mut results = Vec::new();
    for video in videos.items.unwrap_or_default() {
        let id = match video.id {
            Some(id) => id,
            None => continue,
        };
        let snippet = video.snippet;
        let stats = video.statistics;
        let video_title = snippet
            .as_ref()
            .and_then(|s| s.title.clone())
            .unwrap_or_else(|| "Untitled".to_string());
        let preview_raw = snippet
            .as_ref()
            .and_then(|s| s.description.clone())
            .unwrap_or_default();
        let preview: String = preview_raw.chars().take(280).collect();
        let preview = if preview.trim().is_empty() {
            video_title.clone()
        } else {
            preview
        };
        let cover = snippet
            .as_ref()
            .and_then(|s| s.thumbnails.as_ref())
            .and_then(thumb_url);

        results.push(YoutubeVideoResult {
            id: id.clone(),
            title: video_title.clone(),
            preview,
            post_date: snippet
                .as_ref()
                .and_then(|s| s.published_at.clone())
                .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string()),
            canonical_url: format!("https://www.youtube.com/watch?v={}", id),
            views: parse_count(stats.as_ref().and_then(|s| s.view_count.as_ref())),
            likes: parse_count(stats.as_ref().and_then(|s| s.like_count.as_ref())),
            comments: parse_count(stats.as_ref().and_then(|s| s.comment_count.as_ref())),
            creator_name: title.clone(),
            handle: handle_label.clone(),
            creator_photo_url: photo.clone(),
            cover_image: cover,
        });
    }

    results.sort_by(|a, b| b.post_date.cmp(&a.post_date));
    Ok(results)
}
