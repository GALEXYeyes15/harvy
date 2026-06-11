mod commands;

fn load_env_files() {
    let _ = dotenvy::from_filename(".env.local");
    let _ = dotenvy::dotenv();
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
            commands::rename_fs_path,
            commands::export_markdown_pdf,
            commands::get_user_editor_rules_path,
            commands::read_user_editor_rules,
            commands::ensure_user_editor_rules,
            commands::write_user_editor_rules,
            commands::format_generation::generate_twitter_formats,
            commands::format_outputs_store::load_twitter_formats,
            commands::format_outputs_store::save_twitter_formats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
