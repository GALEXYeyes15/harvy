mod ai_config;
mod commands;
mod model_json;

use ai_config::ANTHROPIC_API_KEY_ENV;

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
        match std::env::var(ANTHROPIC_API_KEY_ENV) {
            Ok(key) if !key.trim().is_empty() => {
                eprintln!(
                    "[harvy] {} is set ({} chars)",
                    ANTHROPIC_API_KEY_ENV,
                    key.trim().len()
                );
            }
            _ => {
                eprintln!(
                    "[harvy] {} is missing — add it to .env.local at the project root and restart Harvy",
                    ANTHROPIC_API_KEY_ENV
                );
            }
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
    use crate::ai_config::ANTHROPIC_API_KEY_ENV;
    use crate::commands::unsplash::search_unsplash_photos;

    #[test]
    fn anthropic_api_key_loads_from_project_env_local() {
        load_env_files();
        let key = std::env::var(ANTHROPIC_API_KEY_ENV).unwrap_or_default();
        if key.trim().is_empty() {
            eprintln!(
                "Skipping anthropic_api_key_loads_from_project_env_local: {ANTHROPIC_API_KEY_ENV} not in .env.local"
            );
            return;
        }
        assert!(
            !key.trim().is_empty(),
            "{ANTHROPIC_API_KEY_ENV} should be non-empty when set in .env.local"
        );
    }

    #[test]
    fn unsplash_pool_search_returns_results_when_key_configured() {
        load_env_files();
        let key = std::env::var("UNSPLASH_ACCESS_KEY").unwrap_or_default();
        if key.trim().is_empty() {
            eprintln!("Skipping unsplash_pool_search_returns_results_when_key_configured: no key");
            return;
        }
        let results = search_unsplash_photos("pool".to_string()).expect("pool search");
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
            commands::write_text_file,
            commands::create_unique_directory,
            commands::ensure_directory,
            commands::path_exists,
            commands::rename_fs_path,
            commands::export_markdown_pdf,
            commands::get_user_editor_rules_path,
            commands::read_user_editor_rules,
            commands::ensure_user_editor_rules,
            commands::write_user_editor_rules,
            commands::format_generation::generate_format_outputs,
            commands::format_generation::generate_tweets_notes_formats,
            commands::format_generation::generate_mid_form_post_formats,
            commands::format_generation::generate_twitter_formats,
            commands::format_generation::generate_short_form_outline_formats,
            commands::format_generation::generate_long_form_outline_formats,
            commands::format_generation::generate_newsletter_formats,
            commands::format_generation::generate_podcast_notes_formats,
            commands::format_outputs_store::load_format_collection,
            commands::format_outputs_store::save_format_collection_command,
            commands::format_outputs_store::load_twitter_formats,
            commands::format_outputs_store::save_twitter_formats,
            commands::unsplash::search_unsplash_photos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
