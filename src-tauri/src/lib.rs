mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
