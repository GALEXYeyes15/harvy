mod commands;

fn load_env_files() {
    let mut candidates: Vec<std::path::PathBuf> = vec![
        std::path::PathBuf::from(".env.local"),
        std::path::PathBuf::from(".env"),
        std::path::PathBuf::from("../.env.local"),
        std::path::PathBuf::from("../.env"),
    ];

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join(".env.local"));
        candidates.push(cwd.join(".env"));
        if let Some(parent) = cwd.parent() {
            candidates.push(parent.join(".env.local"));
            candidates.push(parent.join(".env"));
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join(".env.local"));
            if let Some(parent) = dir.parent() {
                candidates.push(parent.join(".env.local"));
            }
        }
    }

    for path in candidates {
        let _ = dotenvy::from_path(&path);
    }

    #[cfg(debug_assertions)]
    match std::env::var("UNSPLASH_ACCESS_KEY") {
        Ok(key) if !key.trim().is_empty() => {
            eprintln!("[harvy] UNSPLASH_ACCESS_KEY loaded.");
        }
        _ => {
            eprintln!(
                "[harvy] UNSPLASH_ACCESS_KEY is not set. Unsplash search will fail until you add it to .env.local and restart Harvy."
            );
        }
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
