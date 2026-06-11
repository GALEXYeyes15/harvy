use serde::{Deserialize, Serialize};

pub const MAX_TWITTER_FORMAT_COUNT: i64 = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatInspirationExample {
    pub preview: String,
    pub format: String,
    #[serde(rename = "type")]
    pub example_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwitterFormatItem {
    pub id: String,
    pub text: String,
    pub status: String,
    pub favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwitterFormatCollection {
    pub platform: String,
    #[serde(rename = "type")]
    pub collection_type: String,
    pub title: String,
    pub items: Vec<TwitterFormatItem>,
}

impl TwitterFormatCollection {
    pub fn new(title: String, items: Vec<TwitterFormatItem>) -> Self {
        Self {
            platform: "twitter".to_string(),
            collection_type: "collection".to_string(),
            title,
            items,
        }
    }
}
