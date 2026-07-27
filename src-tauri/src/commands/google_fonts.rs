//! Fetch the public Google Fonts metadata catalog (avoids browser CORS).

use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const METADATA_URL: &str = "https://fonts.google.com/metadata/fonts";
const TAGS_CSV_URL: &str =
    "https://raw.githubusercontent.com/google/fonts/main/tags/all/families.csv";
const USER_AGENT: &str = "Harvy/0.1 (Google Fonts catalog)";
const EXPRESSIVE_PREFIX: &str = "/Expressive/";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleFontFeeling {
    pub id: String,
    pub weight: i32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoogleFontCatalogEntry {
    pub family: String,
    pub category: String,
    pub popularity: i64,
    pub trending: i64,
    pub style_count: u32,
    pub designers: Vec<String>,
    pub stroke: Option<String>,
    pub subsets: Vec<String>,
    pub date_added: Option<String>,
    pub feelings: Vec<GoogleFontFeeling>,
}

#[derive(Debug, Deserialize)]
struct MetadataPayload {
    #[serde(rename = "familyMetadataList")]
    family_metadata_list: Option<Vec<FamilyMetadata>>,
}

#[derive(Debug, Deserialize)]
struct FamilyMetadata {
    family: Option<String>,
    category: Option<String>,
    popularity: Option<i64>,
    trending: Option<i64>,
    designers: Option<Vec<String>>,
    stroke: Option<String>,
    subsets: Option<Vec<String>>,
    #[serde(rename = "dateAdded")]
    date_added: Option<String>,
    fonts: Option<serde_json::Value>,
}

fn http_client() -> Result<Client, String> {
    Client::builder()
        .user_agent(USER_AGENT)
        .timeout(std::time::Duration::from_secs(45))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))
}

fn style_count(fonts: &Option<serde_json::Value>) -> u32 {
    match fonts {
        Some(serde_json::Value::Object(map)) => map.len() as u32,
        _ => 1,
    }
}

fn parse_feelings_csv(raw: &str) -> HashMap<String, Vec<GoogleFontFeeling>> {
    let mut map: HashMap<String, Vec<GoogleFontFeeling>> = HashMap::new();
    for line in raw.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() < 4 {
            continue;
        }
        let family = parts[0].trim();
        let tag = parts[2].trim();
        let weight: i32 = parts[3].trim().parse().unwrap_or(0);
        if family.is_empty() || weight <= 0 {
            continue;
        }
        let Some(feeling) = tag.strip_prefix(EXPRESSIVE_PREFIX) else {
            continue;
        };
        if feeling.is_empty() {
            continue;
        }
        map.entry(family.to_string())
            .or_default()
            .push(GoogleFontFeeling {
                id: feeling.to_string(),
                weight,
            });
    }
    for feelings in map.values_mut() {
        feelings.sort_by(|a, b| b.weight.cmp(&a.weight).then_with(|| a.id.cmp(&b.id)));
    }
    map
}

fn parse_catalog(
    raw: &str,
    feelings_by_family: &HashMap<String, Vec<GoogleFontFeeling>>,
) -> Result<Vec<GoogleFontCatalogEntry>, String> {
    let trimmed = raw.trim();
    let json = trimmed
        .strip_prefix(")]}'")
        .map(str::trim)
        .unwrap_or(trimmed);

    let payload: MetadataPayload =
        serde_json::from_str(json).map_err(|e| format!("Google Fonts catalog parse error: {e}"))?;

    let mut out: Vec<GoogleFontCatalogEntry> = payload
        .family_metadata_list
        .unwrap_or_default()
        .into_iter()
        .filter_map(|row| {
            let family = row.family?.trim().to_string();
            if family.is_empty() {
                return None;
            }
            let subsets = row
                .subsets
                .unwrap_or_default()
                .into_iter()
                .filter(|s| s != "menu")
                .collect();
            let feelings = feelings_by_family
                .get(&family)
                .cloned()
                .unwrap_or_default();
            Some(GoogleFontCatalogEntry {
                style_count: style_count(&row.fonts),
                family,
                category: row
                    .category
                    .unwrap_or_else(|| "Sans Serif".to_string()),
                popularity: row.popularity.unwrap_or(9_999),
                trending: row.trending.unwrap_or(9_999),
                designers: row.designers.unwrap_or_default(),
                stroke: row.stroke.filter(|s| !s.trim().is_empty()),
                subsets,
                date_added: row.date_added,
                feelings,
            })
        })
        .collect();

    out.sort_by(|a, b| {
        a.popularity
            .cmp(&b.popularity)
            .then_with(|| a.family.to_lowercase().cmp(&b.family.to_lowercase()))
    });

    Ok(out)
}

fn fetch_google_fonts_catalog_impl() -> Result<Vec<GoogleFontCatalogEntry>, String> {
    let client = http_client()?;

    let tags_response = client
        .get(TAGS_CSV_URL)
        .send()
        .map_err(|e| format!("Google Fonts tags request failed: {e}"))?;
    if !tags_response.status().is_success() {
        return Err(format!(
            "Google Fonts tags request failed ({})",
            tags_response.status()
        ));
    }
    let tags_body = tags_response
        .text()
        .map_err(|e| format!("Google Fonts tags response error: {e}"))?;
    let feelings_by_family = parse_feelings_csv(&tags_body);

    let response = client
        .get(METADATA_URL)
        .send()
        .map_err(|e| format!("Google Fonts request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Google Fonts request failed ({})",
            response.status()
        ));
    }

    let body = response
        .text()
        .map_err(|e| format!("Google Fonts response error: {e}"))?;
    parse_catalog(&body, &feelings_by_family)
}

#[tauri::command]
pub fn fetch_google_fonts_catalog() -> Result<Vec<GoogleFontCatalogEntry>, String> {
    fetch_google_fonts_catalog_impl()
}

#[cfg(test)]
mod tests {
    use super::{parse_catalog, parse_feelings_csv};
    use std::collections::HashMap;

    #[test]
    fn parses_feelings_csv() {
        let csv = "\
Inter,,/Expressive/Business,80
Inter,,/Sans/Humanist,40
Inter,,/Expressive/Calm,20
";
        let map = parse_feelings_csv(csv);
        let feelings = map.get("Inter").expect("Inter");
        assert_eq!(feelings.len(), 2);
        assert_eq!(feelings[0].id, "Business");
        assert_eq!(feelings[0].weight, 80);
    }

    #[test]
    fn parses_metadata_with_xssi_prefix() {
        let raw = r#")]}'
{"familyMetadataList":[{"family":"Inter","category":"Sans Serif","popularity":1,"trending":2,"designers":["Rasmus Andersson"],"stroke":"Sans Serif","subsets":["menu","latin"],"fonts":{"400":{},"700":{}}}]}
"#;
        let mut feelings = HashMap::new();
        feelings.insert(
            "Inter".to_string(),
            vec![super::GoogleFontFeeling {
                id: "Business".to_string(),
                weight: 70,
            }],
        );
        let fonts = parse_catalog(raw, &feelings).expect("parse");
        assert_eq!(fonts.len(), 1);
        assert_eq!(fonts[0].family, "Inter");
        assert_eq!(fonts[0].feelings[0].id, "Business");
        assert_eq!(fonts[0].style_count, 2);
    }
}
