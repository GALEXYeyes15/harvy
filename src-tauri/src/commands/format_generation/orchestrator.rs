use super::openai;
use super::types::{
    FormatCategoryJobResult, FormatCollection, FormatGenerationOrchestratorResult,
    FormatGenerationRequest, FormatOutputItem,
};
use crate::commands::format_outputs_store;
use tauri::AppHandle;

struct CategoryJobSpec {
    id: &'static str,
    selected: bool,
    amount: i64,
    item_prefix: &'static str,
    default_title: &'static str,
}

fn estimate_format_output_count(word_count: i64, slider: i64, dense: i64, sparse: i64) -> i64 {
    if word_count <= 0 {
        return 0;
    }
    let density = (slider.clamp(0, 100) as f64) / 100.0;
    let content_cost = sparse as f64 + (dense - sparse) as f64 * density;
    let rounded = (word_count as f64 / content_cost).round() as i64;
    rounded.max(1)
}

fn content_costs(category: &str) -> (i64, i64) {
    match category {
        "tweets_notes" => (20, 80),
        "short_form_outline" => (50, 200),
        "long_form_outline" => (500, 2000),
        "newsletter" => (1000, 3000),
        "podcast_notes" => (250, 1000),
        _ => (100, 400),
    }
}

fn selected_categories(request: &FormatGenerationRequest) -> Vec<CategoryJobSpec> {
    let selection = &request.selected_formats;
    let amounts = &request.category_amounts;
    vec![
        CategoryJobSpec {
            id: "tweets_notes",
            selected: selection.tweets_notes,
            amount: amounts.tweets_notes,
            item_prefix: "tweets-notes",
            default_title: "Tweets / Notes — generated",
        },
        CategoryJobSpec {
            id: "short_form_outline",
            selected: selection.short_form_outline,
            amount: amounts.short_form_outline,
            item_prefix: "short-form-outline",
            default_title: "Short Form Outline — generated",
        },
        CategoryJobSpec {
            id: "long_form_outline",
            selected: selection.long_form_outline,
            amount: amounts.long_form_outline,
            item_prefix: "long-form-outline",
            default_title: "Long Form Outline — generated",
        },
        CategoryJobSpec {
            id: "newsletter",
            selected: selection.newsletter,
            amount: amounts.newsletter,
            item_prefix: "newsletter",
            default_title: "Newsletter — generated",
        },
        CategoryJobSpec {
            id: "podcast_notes",
            selected: selection.podcast_notes,
            amount: amounts.podcast_notes,
            item_prefix: "podcast-notes",
            default_title: "Podcast Notes — generated",
        },
    ]
    .into_iter()
    .filter(|spec| spec.selected)
    .collect()
}

fn run_tweets_notes_job(
    essay_text: &str,
    target_count: i64,
    examples: &[super::types::FormatInspirationExample],
) -> FormatCategoryJobResult {
    match openai::generate_tweets_notes_collection(essay_text, target_count, examples) {
        Ok(collection) => collection_to_success("tweets_notes", collection),
        Err(error) => FormatCategoryJobResult::Error { error },
    }
}

fn run_category_job(
    category: &str,
    essay_text: &str,
    target_count: i64,
    examples: &[super::types::FormatInspirationExample],
    _item_prefix: &str,
    _default_title: &str,
) -> FormatCategoryJobResult {
    if category == "tweets_notes" {
        return run_tweets_notes_job(essay_text, target_count, examples);
    }

    let error = match category {
        "short_form_outline" => "Short Form Outline generation is not yet implemented",
        "long_form_outline" => "Long Form Outline generation is not yet implemented",
        "newsletter" => "Newsletter generation is not yet implemented",
        "podcast_notes" => "Podcast Notes generation is not yet implemented",
        _ => "Unknown format category",
    };
    FormatCategoryJobResult::Error {
        error: error.to_string(),
    }
}

fn collection_to_success(category: &str, collection: FormatCollection) -> FormatCategoryJobResult {
    FormatCategoryJobResult::Success {
        category: category.to_string(),
        collection_type: "collection".to_string(),
        title: collection.title,
        outputs: collection
            .items
            .into_iter()
            .map(|item| FormatOutputItem {
                id: item.id,
                title: item.title,
                content: item.content,
                status: item.status,
                favorite: item.favorite,
            })
            .collect(),
    }
}

fn collection_from_success(result: &FormatCategoryJobResult) -> Option<FormatCollection> {
    match result {
        FormatCategoryJobResult::Success {
            category,
            title,
            outputs,
            ..
        } => Some(FormatCollection::new(
            category,
            title.clone(),
            outputs
                .iter()
                .map(|item| FormatOutputItem {
                    id: item.id.clone(),
                    title: item.title.clone(),
                    content: item.content.clone(),
                    status: item.status.clone(),
                    favorite: item.favorite,
                })
                .collect(),
        )),
        FormatCategoryJobResult::Error { .. } => None,
    }
}

fn set_category_result(
    result: &mut FormatGenerationOrchestratorResult,
    category: &str,
    job_result: FormatCategoryJobResult,
) {
    match category {
        "tweets_notes" => result.tweets_notes = Some(job_result),
        "short_form_outline" => result.short_form_outline = Some(job_result),
        "long_form_outline" => result.long_form_outline = Some(job_result),
        "newsletter" => result.newsletter = Some(job_result),
        "podcast_notes" => result.podcast_notes = Some(job_result),
        _ => {}
    }
}

pub fn generate_format_outputs(
    app: &AppHandle,
    request: FormatGenerationRequest,
) -> Result<FormatGenerationOrchestratorResult, String> {
    let trimmed = request.essay_text.trim();
    if trimmed.is_empty() {
        return Err("Essay text is empty".to_string());
    }

    let categories = selected_categories(&request);
    if categories.is_empty() {
        return Err("Select at least one format to generate".to_string());
    }

    let essay_text = trimmed.to_string();
    let word_count = request.word_count;
    let examples_by_category = request.inspiration_examples_by_category.clone();

    let mut result = FormatGenerationOrchestratorResult::default();

    std::thread::scope(|scope| {
        let handles: Vec<_> = categories
            .iter()
            .map(|spec| {
                let essay = essay_text.clone();
                let examples = examples_by_category
                    .get(spec.id)
                    .cloned()
                    .unwrap_or_default();
                let (dense, sparse) = content_costs(spec.id);
                let target_count =
                    estimate_format_output_count(word_count, spec.amount, dense, sparse);
                scope.spawn(move || {
                    let job_result = run_category_job(
                        spec.id,
                        &essay,
                        target_count,
                        &examples,
                        spec.item_prefix,
                        spec.default_title,
                    );
                    (spec.id, job_result)
                })
            })
            .collect();

        for handle in handles {
            if let Ok((category, job_result)) = handle.join() {
                set_category_result(&mut result, category, job_result);
            }
        }
    });

    if let Some(tweets_result) = result.tweets_notes.as_ref() {
        if let Some(collection) = collection_from_success(tweets_result) {
            let document_key =
                format_outputs_store::resolve_document_key(request.document_id.as_deref(), &request.essay_title);
            let _ = format_outputs_store::save_format_collection(
                app,
                &document_key,
                &request.essay_title,
                "tweets_notes",
                &collection,
            );
        }
    }

    Ok(result)
}
