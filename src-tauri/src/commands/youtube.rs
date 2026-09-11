use regex::Regex;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

const MAX_VIDEOS: usize = 50;
const USER_AGENT: &str = "Harvy/0.1 (YouTube public archive)";

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

fn youtube_api_key() -> Option<String> {
    let key = std::env::var("YOUTUBE_API_KEY").unwrap_or_default();
    let trimmed = key.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .user_agent(USER_AGENT)
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

fn decode_xml(text: &str) -> String {
    text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
}

fn xml_tag<'a>(block: &'a str, tag: &str) -> Option<String> {
    let pattern = format!(r"(?s)<{}[^>]*>(.*?)</{}>", regex::escape(tag), regex::escape(tag));
    let re = Regex::new(&pattern).ok()?;
    re.captures(block)
        .and_then(|caps| caps.get(1))
        .map(|m| decode_xml(m.as_str().trim()))
}

fn xml_attr(block: &str, tag: &str, attr: &str) -> Option<String> {
    let pattern = format!(r#"(?s)<{}[^>]*\s{}="([^"]+)""#, regex::escape(tag), regex::escape(attr));
    let re = Regex::new(&pattern).ok()?;
    re.captures(block)
        .and_then(|caps| caps.get(1))
        .map(|m| decode_xml(m.as_str()))
}

fn extract_channel_id_from_html(html: &str) -> Option<String> {
    let patterns = [
        r#""externalId":"(UC[\w-]{22})""#,
        r#""browseId":"(UC[\w-]{22})""#,
        r#""channelId":"(UC[\w-]{22})""#,
    ];
    for pattern in patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(caps) = re.captures(html) {
                if let Some(id) = caps.get(1) {
                    return Some(id.as_str().to_string());
                }
            }
        }
    }
    None
}

fn extract_channel_meta_from_html(
    html: &str,
    fallback_handle: Option<&str>,
) -> (Option<String>, Option<String>, Option<String>, Option<String>) {
    let channel_id = extract_channel_id_from_html(html);
    let person_re = Regex::new(
        r#""@type":"Person"[^}]*"name":"([^"]+)"[^}]*"alternateName":"(@[^"]+)""#,
    )
    .ok();
    let image_re = Regex::new(r#""@type":"Person"[^}]*"image":"(https:[^"]+)""#).ok();
    let (title, handle) = person_re
        .and_then(|re| re.captures(html))
        .map(|caps| {
            (
                caps.get(1).map(|m| m.as_str().to_string()),
                caps.get(2).map(|m| m.as_str().to_string()),
            )
        })
        .unwrap_or((None, None));
    let photo = image_re
        .and_then(|re| re.captures(html))
        .and_then(|caps| caps.get(1).map(|m| m.as_str().to_string()));
    let handle = handle.or_else(|| {
        fallback_handle.map(|h| {
            if h.starts_with('@') {
                h.to_string()
            } else {
                format!("@{}", h)
            }
        })
    });
    (channel_id, title, handle, photo)
}

fn fetch_text(client: &Client, url: &str) -> Result<String, String> {
    let response = client
        .get(url)
        .header("Accept", "text/html,application/xml")
        .send()
        .map_err(|e| format!("YouTube request failed: {}", e))?;
    if !response.status().is_success() {
        return Err(format!("YouTube request failed ({}).", response.status()));
    }
    response
        .text()
        .map_err(|e| format!("Could not read YouTube response: {}", e))
}

struct ResolvedChannel {
    channel_id: String,
    title: String,
    handle: String,
    photo_url: Option<String>,
}

fn resolve_youtube_channel_public(client: &Client, source_url: &str) -> Result<ResolvedChannel, String> {
    let (channel_id, handle) = parse_youtube_channel_input(source_url)?;
    if let Some(id) = channel_id {
        let rss_url = format!(
            "https://www.youtube.com/feeds/videos.xml?channel_id={}",
            urlencoding_encode(&id)
        );
        let rss_xml = fetch_text(client, &rss_url)?;
        let title = xml_tag(&rss_xml, "title").unwrap_or_else(|| id.clone());
        return Ok(ResolvedChannel {
            channel_id: id,
            title: title.clone(),
            handle: format!("@{}", title.replace(' ', "")),
            photo_url: None,
        });
    }

    let handle = handle.ok_or_else(|| "YouTube channel not found.".to_string())?;
    let page_url = format!(
        "https://www.youtube.com/@{}/videos",
        urlencoding_encode(&handle)
    );
    let html = fetch_text(client, &page_url)?;
    let (resolved_id, title, resolved_handle, photo) =
        extract_channel_meta_from_html(&html, Some(&handle));
    let channel_id = resolved_id.ok_or_else(|| "YouTube channel not found.".to_string())?;
    Ok(ResolvedChannel {
        channel_id,
        title: title.unwrap_or_else(|| handle.clone()),
        handle: resolved_handle.unwrap_or_else(|| format!("@{}", handle)),
        photo_url: photo,
    })
}

fn urlencoding_encode(input: &str) -> String {
    input
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (b as char).to_string()
            }
            _ => format!("%{:02X}", b),
        })
        .collect()
}

fn parse_youtube_rss_entries(xml: &str, channel: &ResolvedChannel) -> Vec<YoutubeVideoResult> {
    let mut results = Vec::new();
    for block in xml.split("<entry>").skip(1).take(MAX_VIDEOS) {
        let Some(id) = xml_tag(block, "yt:videoId") else {
            continue;
        };
        let title = xml_tag(block, "title")
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .unwrap_or_else(|| "Untitled".to_string());
        let description = xml_tag(block, "media:description").unwrap_or_default();
        let preview_raw: String = description.chars().take(280).collect();
        let preview = if preview_raw.trim().is_empty() {
            title.clone()
        } else {
            preview_raw
        };
        let post_date = xml_tag(block, "published").unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());
        let views = xml_attr(block, "media:statistics", "views")
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(0);
        let likes = xml_attr(block, "media:starRating", "count")
            .and_then(|v| v.parse::<u32>().ok())
            .unwrap_or(0);
        let cover_image = xml_attr(block, "media:thumbnail", "url");
        results.push(YoutubeVideoResult {
            id: id.clone(),
            title: title.clone(),
            preview,
            post_date,
            canonical_url: format!("https://www.youtube.com/watch?v={}", id),
            views,
            likes,
            comments: 0,
            creator_name: channel.title.clone(),
            handle: channel.handle.clone(),
            creator_photo_url: channel.photo_url.clone(),
            cover_image,
        });
    }
    results.sort_by(|a, b| b.post_date.cmp(&a.post_date));
    results
}

fn fetch_youtube_videos_via_rss(client: &Client, source_url: &str) -> Result<Vec<YoutubeVideoResult>, String> {
    let channel = resolve_youtube_channel_public(client, source_url)?;
    let rss_url = format!(
        "https://www.youtube.com/feeds/videos.xml?channel_id={}",
        urlencoding_encode(&channel.channel_id)
    );
    let rss_xml = fetch_text(client, &rss_url)?;
    Ok(parse_youtube_rss_entries(&rss_xml, &channel))
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

fn fetch_youtube_videos_via_api(
    client: &Client,
    key: &str,
    source_url: &str,
) -> Result<Vec<YoutubeVideoResult>, String> {
    let (channel_id, handle) = parse_youtube_channel_input(source_url)?;

    let channel_response: ChannelListResponse = if let Some(id) = channel_id {
        youtube_get(
            client,
            key,
            "channels",
            &[("part", "snippet,contentDetails".to_string()), ("id", id)],
        )?
    } else if let Some(h) = handle {
        youtube_get(
            client,
            key,
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
        client,
        key,
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
        client,
        key,
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

#[tauri::command]
pub fn fetch_youtube_videos(source_url: String) -> Result<Vec<YoutubeVideoResult>, String> {
    let client = http_client()?;
    if let Some(key) = youtube_api_key() {
        match fetch_youtube_videos_via_api(&client, &key, &source_url) {
            Ok(results) => return Ok(results),
            Err(_) => return fetch_youtube_videos_via_rss(&client, &source_url),
        }
    }
    fetch_youtube_videos_via_rss(&client, &source_url)
}
