use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};

const UNSPLASH_SEARCH_URL: &str = "https://api.unsplash.com/search/photos";
const UNSPLASH_PHOTOS_URL: &str = "https://api.unsplash.com/photos";
const UNSPLASH_MISSING_KEY_MSG: &str =
    "Missing Unsplash API key. Add UNSPLASH_ACCESS_KEY to .env.local and restart Harvy.";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsplashImageResult {
    pub id: String,
    pub thumb_url: String,
    pub full_url: String,
    pub alt: String,
    pub photographer: String,
    pub photographer_url: String,
    pub unsplash_url: String,
}

#[derive(Debug, Deserialize)]
struct UnsplashSearchResponse {
    results: Vec<UnsplashPhoto>,
}

#[derive(Debug, Deserialize)]
struct UnsplashPhoto {
    id: String,
    #[serde(default)]
    alt_description: Option<String>,
    #[serde(default)]
    description: Option<String>,
    urls: UnsplashUrls,
    links: UnsplashLinks,
    user: UnsplashUser,
}

#[derive(Debug, Deserialize)]
struct UnsplashUrls {
    #[serde(default)]
    small: Option<String>,
    #[serde(default)]
    thumb: Option<String>,
    #[serde(default)]
    regular: Option<String>,
    #[serde(default)]
    full: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UnsplashLinks {
    #[serde(default)]
    html: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UnsplashUser {
    name: String,
    links: UnsplashUserLinks,
}

#[derive(Debug, Deserialize)]
struct UnsplashUserLinks {
    #[serde(default)]
    html: Option<String>,
}

fn unsplash_access_key() -> Result<String, String> {
    let key = std::env::var("UNSPLASH_ACCESS_KEY")
        .map_err(|_| UNSPLASH_MISSING_KEY_MSG.to_string())?
        .trim()
        .to_string();
    if key.is_empty() {
        return Err(UNSPLASH_MISSING_KEY_MSG.to_string());
    }
    Ok(key)
}

fn map_photo(photo: UnsplashPhoto) -> Option<UnsplashImageResult> {
    let thumb_url = photo
        .urls
        .small
        .or(photo.urls.thumb)
        .or_else(|| photo.urls.regular.clone())?;
    let full_url = photo
        .urls
        .regular
        .or(photo.urls.full)
        .unwrap_or_else(|| thumb_url.clone());
    let alt = photo
        .alt_description
        .or(photo.description)
        .unwrap_or_else(|| "Unsplash photo".to_string());
    let photographer = photo.user.name.trim().to_string();
    if photographer.is_empty() {
        return None;
    }
    let photographer_url = photo
        .user
        .links
        .html
        .unwrap_or_else(|| "https://unsplash.com".to_string());
    let unsplash_url = photo
        .links
        .html
        .unwrap_or_else(|| "https://unsplash.com".to_string());

    Some(UnsplashImageResult {
        id: photo.id,
        thumb_url,
        full_url,
        alt,
        photographer,
        photographer_url,
        unsplash_url,
    })
}

fn search_unsplash_photos_impl(
    query: &str,
    page: u32,
    per_page: u32,
) -> Result<Vec<UnsplashImageResult>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Err("Enter a search term.".to_string());
    }

    let page = page.max(1);
    let per_page = per_page.clamp(1, 30);

    let api_key = unsplash_access_key()?;
    let client = Client::builder()
        .build()
        .map_err(|e| format!("Unsplash client error: {e}"))?;

    let response = client
        .get(UNSPLASH_SEARCH_URL)
        .query(&[
            ("query", query),
            ("page", &page.to_string()),
            ("per_page", &per_page.to_string()),
        ])
        .header("Authorization", format!("Client-ID {api_key}"))
        .header("Accept-Version", "v1")
        .send()
        .map_err(|e| format!("Unsplash request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        let detail = body.trim();
        if detail.is_empty() {
            return Err(format!("Unsplash request failed ({status})"));
        }
        return Err(format!("Unsplash request failed ({status}): {detail}"));
    }

    let payload: UnsplashSearchResponse = response
        .json()
        .map_err(|e| format!("Unsplash response error: {e}"))?;

    Ok(payload
        .results
        .into_iter()
        .filter_map(map_photo)
        .collect())
}

#[tauri::command]
pub fn search_unsplash_photos(
    query: String,
    page: Option<u32>,
    per_page: Option<u32>,
) -> Result<Vec<UnsplashImageResult>, String> {
    search_unsplash_photos_impl(&query, page.unwrap_or(1), per_page.unwrap_or(12))
}

fn list_popular_unsplash_photos_impl(page: u32, per_page: u32) -> Result<Vec<UnsplashImageResult>, String> {
    let page = page.max(1);
    let per_page = per_page.clamp(1, 30);

    let api_key = unsplash_access_key()?;
    let client = Client::builder()
        .build()
        .map_err(|e| format!("Unsplash client error: {e}"))?;

    let response = client
        .get(UNSPLASH_PHOTOS_URL)
        .query(&[
            ("order_by", "popular"),
            ("page", &page.to_string()),
            ("per_page", &per_page.to_string()),
        ])
        .header("Authorization", format!("Client-ID {api_key}"))
        .header("Accept-Version", "v1")
        .send()
        .map_err(|e| format!("Unsplash request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        let detail = body.trim();
        if detail.is_empty() {
            return Err(format!("Unsplash request failed ({status})"));
        }
        return Err(format!("Unsplash request failed ({status}): {detail}"));
    }

    let photos: Vec<UnsplashPhoto> = response
        .json()
        .map_err(|e| format!("Unsplash response error: {e}"))?;

    Ok(photos.into_iter().filter_map(map_photo).collect())
}

/// Popular Unsplash photos (closest built-in feed to “trending”).
#[tauri::command]
pub fn list_popular_unsplash_photos(
    page: Option<u32>,
    per_page: Option<u32>,
) -> Result<Vec<UnsplashImageResult>, String> {
    list_popular_unsplash_photos_impl(page.unwrap_or(1), per_page.unwrap_or(12))
}
