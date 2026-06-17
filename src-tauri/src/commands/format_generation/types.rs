use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const MAX_TWITTER_FORMAT_COUNT: i64 = 100;
pub const MAX_FORMAT_OUTPUT_COUNT: i64 = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatInspirationExample {
    pub preview: String,
    pub format: String,
    #[serde(rename = "type")]
    pub example_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatOutputItem {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub content: String,
    pub status: String,
    pub favorite: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatCollection {
    pub category: String,
    #[serde(rename = "type")]
    pub collection_type: String,
    pub title: String,
    pub items: Vec<FormatOutputItem>,
}

impl FormatCollection {
    pub fn new(category: &str, title: String, items: Vec<FormatOutputItem>) -> Self {
        Self {
            category: category.to_string(),
            collection_type: "collection".to_string(),
            title,
            items,
        }
    }
}

/// @deprecated alias — use FormatCollection
pub type TwitterFormatCollection = FormatCollection;
/// @deprecated alias — use FormatOutputItem
pub type TwitterFormatItem = FormatOutputItem;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatCategorySelection {
    pub tweets_notes: bool,
    pub mid_form_post: bool,
    pub short_form_outline: bool,
    pub long_form_outline: bool,
    pub newsletter: bool,
    pub podcast_notes: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormatCategoryAmounts {
    pub tweets_notes: i64,
    pub mid_form_post: i64,
    pub short_form_outline: i64,
    pub long_form_outline: i64,
    pub newsletter: i64,
    pub podcast_notes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatGenerationRequest {
    pub essay_title: String,
    pub essay_text: String,
    pub word_count: i64,
    #[serde(default)]
    pub document_id: Option<String>,
    pub selected_formats: FormatCategorySelection,
    #[serde(rename = "categoryAmounts")]
    pub category_amounts: FormatCategoryAmounts,
    #[serde(default)]
    #[serde(rename = "inspirationExamplesByCategory")]
    pub inspiration_examples_by_category: HashMap<String, Vec<FormatInspirationExample>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum FormatCategoryJobResult {
    Success {
        category: String,
        #[serde(rename = "type")]
        collection_type: String,
        title: String,
        outputs: Vec<FormatOutputItem>,
    },
    Error {
        error: String,
    },
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct FormatGenerationOrchestratorResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tweets_notes: Option<FormatCategoryJobResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mid_form_post: Option<FormatCategoryJobResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub short_form_outline: Option<FormatCategoryJobResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub long_form_outline: Option<FormatCategoryJobResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub newsletter: Option<FormatCategoryJobResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub podcast_notes: Option<FormatCategoryJobResult>,
}
