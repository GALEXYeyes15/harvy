mod commands;

use std::path::PathBuf;

pub(crate) fn load_env_files() {
    let mut candidates: Vec<PathBuf> = vec![
        PathBuf::from(".env.local"),
        PathBuf::from(".env"),
        PathBuf::from("../.env.local"),
        PathBuf::from("../.env"),
    ];

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(project_root) = manifest_dir.parent() {
        candidates.push(project_root.join(".env.local"));
        candidates.push(project_root.join(".env"));
    }

    let mut loaded_paths: Vec<PathBuf> = Vec::new();
    for path in candidates {
        if !path.is_file() {
            continue;
        }
        // Override so edits to .env.local are visible without restarting the Tauri process.
        if dotenvy::from_path_override(&path).is_ok() {
            loaded_paths.push(path);
        }
    }

    #[cfg(debug_assertions)]
    {
        for path in &loaded_paths {
            eprintln!("[harvy] loaded env file: {}", path.display());
        }
        if loaded_paths.is_empty() {
            eprintln!("[harvy] no .env file found (checked project root and parent paths)");
        }
        match std::env::var("UNSPLASH_ACCESS_KEY") {
            Ok(key) if !key.trim().is_empty() => {
                eprintln!(
                    "[harvy] UNSPLASH_ACCESS_KEY is set ({} chars)",
                    key.trim().len()
                );
            }
            _ => {
                eprintln!(
                    "[harvy] UNSPLASH_ACCESS_KEY is missing — add it to .env.local at the project root and restart Harvy"
                );
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::load_env_files;
    use crate::commands::unsplash::search_unsplash_photos;

    #[test]
    fn unsplash_pool_search_returns_results_when_key_configured() {
        load_env_files();
        let key = std::env::var("UNSPLASH_ACCESS_KEY").unwrap_or_default();
        if key.trim().is_empty() {
            eprintln!("Skipping unsplash_pool_search_returns_results_when_key_configured: no key");
            return;
        }
        let results = search_unsplash_photos("pool".to_string(), None, None).expect("pool search");
        assert!(!results.is_empty(), "expected pool search results");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    load_env_files();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_workspace_root,
            commands::set_workspace_root,
            commands::get_workspace_tree,
            commands::get_volume_display_name_for_path,
            commands::read_workspace_text_file,
            commands::import_workspace_image,
            commands::import_headline_screenshot,
            commands::write_headline_screenshot,
            commands::delete_headline_screenshot,
            commands::read_headline_screenshot,
            commands::write_text_file,
            commands::copy_file_into_directory,
            commands::write_bytes_into_directory,
            commands::download_url_into_directory,
            commands::create_unique_directory,
            commands::ensure_directory,
            commands::path_exists,
            commands::rename_fs_path,
            commands::export_markdown_pdf,
            commands::pdf_import::extract_pdf_text,
            commands::print::print_markdown,
            commands::share::share_markdown,
            commands::get_user_editor_rules_path,
            commands::read_user_editor_rules,
            commands::ensure_user_editor_rules,
            commands::write_user_editor_rules,
            commands::unsplash::search_unsplash_photos,
            commands::unsplash::list_popular_unsplash_photos,
            commands::substack::fetch_substack_posts,
            commands::substack::fetch_substack_comments,
            commands::medium::fetch_medium_posts,
            commands::youtube::fetch_youtube_videos,
            commands::google_fonts::fetch_google_fonts_catalog,
            commands::color_picker::pick_screen_color,
            commands::notion::notion_get_ideas_config,
            commands::notion::notion_save_ideas_config,
            commands::notion::notion_clear_ideas_config,
            commands::notion::notion_fetch_database_schema,
            commands::notion::notion_query_idea_pages,
            commands::notion::notion_mark_idea_started,
            commands::notion::notion_test_ideas_connection,
            commands::ai_check::ai_check_get_config,
            commands::ai_check::ai_check_save_config,
            commands::ai_check::ai_check_set_enabled,
            commands::ai_check::ai_check_set_show_replace_suggestions,
            commands::ai_check::ai_check_clear_config,
            commands::ai_check::ai_check_detect_provider,
            commands::ai_check::ai_check_list_models,
            commands::ai_check::ai_check_test_connection,
            commands::ai_check::ai_check_run,
            commands::ai_check::ai_check_podcast_notes,
            commands::ai_check::ai_check_headline_pairs,
            commands::ai_check::ai_check_headline_pairs_from_shots,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
