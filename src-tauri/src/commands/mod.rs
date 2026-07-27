use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri::Manager;

pub mod unsplash;
pub mod substack;
pub mod google_fonts;
mod pdf_export;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    File,
    Directory,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub kind: NodeKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

fn sort_nodes(nodes: &mut [FileNode]) {
    nodes.sort_by(|a, b| match (&a.kind, &b.kind) {
        (NodeKind::Directory, NodeKind::File) => std::cmp::Ordering::Less,
        (NodeKind::File, NodeKind::Directory) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
}

fn build_tree(path: &Path, depth: usize, root_label: &str) -> Result<FileNode, String> {
    let name = if depth == 0 {
        root_label.to_string()
    } else {
        path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string())
    };

    let mut node = FileNode {
        name,
        path: path.to_string_lossy().to_string(),
        kind: NodeKind::Directory,
        children: Some(Vec::new()),
    };

    let entries = fs::read_dir(path).map_err(|e| format!("Could not read '{}': {}", path.display(), e))?;
    let mut children = Vec::new();

    for entry_result in entries {
        let entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };
        let child_path = entry.path();
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };

        if file_type.is_dir() {
            match build_tree(&child_path, depth + 1, root_label) {
                Ok(child) => children.push(child),
                Err(_) => continue,
            }
        } else if file_type.is_file() {
            let name = child_path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| child_path.to_string_lossy().to_string());
            children.push(FileNode {
                name,
                path: child_path.to_string_lossy().to_string(),
                kind: NodeKind::File,
                children: None,
            });
        }
    }

    sort_nodes(&mut children);
    node.children = Some(children);
    Ok(node)
}

const USER_RULES_FILE_NAME: &str = "editorRules-user.json";
const WORKSPACE_ROOT_FILE_NAME: &str = "workspace-root.txt";

fn canonical(path: &Path) -> Result<PathBuf, String> {
    path.canonicalize()
        .map_err(|e| format!("Could not resolve path '{}': {}", path.display(), e))
}

pub(crate) fn app_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Could not resolve app config directory: {}", e))?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Could not create app config directory '{}': {}", dir.display(), e))?;
    Ok(dir)
}

fn read_workspace_root_config(app: &AppHandle) -> Result<Option<PathBuf>, String> {
    let path = app_config_dir(app)?.join(WORKSPACE_ROOT_FILE_NAME);
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path)
        .map_err(|e| format!("Could not read workspace root '{}': {}", path.display(), e))?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let candidate = PathBuf::from(trimmed);
    if !candidate.is_dir() {
        return Ok(None);
    }
    Ok(Some(canonical(&candidate)?))
}

fn write_workspace_root_config(app: &AppHandle, root: &Path) -> Result<(), String> {
    let path = app_config_dir(app)?.join(WORKSPACE_ROOT_FILE_NAME);
    let canonical_root = canonical(root)?;
    fs::write(&path, canonical_root.to_string_lossy().as_bytes()).map_err(|e| {
        format!(
            "Could not save workspace root '{}': {}",
            path.display(),
            e
        )
    })
}

fn workspace_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
    read_workspace_root_config(app)?
        .ok_or_else(|| "No workspace folder selected. Choose a folder first.".to_string())
}

fn ensure_within_workspace_root(app: &AppHandle, requested: &Path) -> Result<PathBuf, String> {
    let root = canonical(&workspace_root_dir(app)?)?;
    let requested = canonical(requested)?;
    if requested.starts_with(&root) {
        Ok(requested)
    } else {
        Err("Access outside the selected workspace folder is not allowed.".to_string())
    }
}

fn user_rules_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_config_dir(app)?.join(USER_RULES_FILE_NAME))
}

#[tauri::command]
pub fn get_workspace_root(app: AppHandle) -> Result<Option<String>, String> {
    Ok(read_workspace_root_config(&app)?
        .map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn set_workspace_root(app: AppHandle, path: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Empty path.".to_string());
    }
    let candidate = PathBuf::from(trimmed);
    if !candidate.is_dir() {
        return Err("Selected path is not a directory.".to_string());
    }
    let canonical_root = canonical(&candidate)?;
    write_workspace_root_config(&app, &canonical_root)?;
    Ok(canonical_root.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_workspace_tree(app: AppHandle) -> Result<FileNode, String> {
    let root = workspace_root_dir(&app)?;
    let canonical_root = canonical(&root)?;
    let root_label = canonical_root
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Workspace".to_string());
    build_tree(&canonical_root, 0, &root_label)
}

/// Localized volume name for the filesystem containing `path` (e.g. `Macintosh HD` on macOS).
#[tauri::command]
pub fn get_volume_display_name_for_path(app: AppHandle, path: String) -> Result<String, String> {
    let p = PathBuf::from(path.trim());
    if p.as_os_str().is_empty() {
        return Err("Empty path.".to_string());
    }
    let safe_path = ensure_within_workspace_root(&app, &p)?;

    #[cfg(target_os = "macos")]
    {
        return Ok(volume_name_macos(&safe_path).unwrap_or_else(|| "Local Drive".to_string()));
    }

    #[cfg(target_os = "windows")]
    {
        return Ok(volume_display_name_windows(&safe_path));
    }

    #[cfg(target_os = "linux")]
    {
        return Ok(volume_display_name_linux(&safe_path));
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Ok("Local Drive".to_string())
    }
}

fn mount_point_for_path(path: &Path) -> Option<PathBuf> {
    let path_arg = path.to_string_lossy();
    let output = std::process::Command::new("df")
        .args(["-P", path_arg.as_ref()])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let data_line = stdout.lines().skip(1).find(|line| !line.trim().is_empty())?;
    let mount = data_line.split_whitespace().last()?;
    Some(PathBuf::from(mount))
}

#[cfg(target_os = "macos")]
fn volume_name_macos(path: &Path) -> Option<String> {
    let mount_point = mount_point_for_path(path).or_else(|| Some(path.to_path_buf()))?;
    volume_name_for_mount_macos(&mount_point)
}

#[cfg(target_os = "macos")]
fn volume_name_for_mount_macos(mount: &Path) -> Option<String> {
    let mount_str = mount.to_string_lossy();

    if mount_str.starts_with("/Volumes/") {
        let name = mount
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .filter(|s| !s.is_empty())?;
        return Some(name);
    }

    if let Some(name) = volume_name_from_diskutil(mount) {
        let normalized = normalize_macos_volume_label(&name);
        if normalized != "Data" {
            return Some(normalized);
        }
    }

    if mount_str == "/System/Volumes/Data"
        || mount_str.starts_with("/System/Volumes/Data/")
        || mount_str == "/"
    {
        if let Some(name) = volume_name_from_diskutil(Path::new("/")) {
            let normalized = normalize_macos_volume_label(&name);
            if !normalized.is_empty() && normalized != "Data" {
                return Some(normalized);
            }
        }

        if let Ok(entries) = std::fs::read_dir("/Volumes") {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(name) = volume_name_from_diskutil(&path) {
                    let normalized = normalize_macos_volume_label(&name);
                    if normalized.is_empty() || normalized == "Data" {
                        continue;
                    }
                    let volume_dir = path
                        .file_name()
                        .map(|n| n.to_string_lossy().into_owned());
                    if volume_dir.as_deref() == Some(normalized.as_str()) {
                        return Some(normalized);
                    }
                }
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn volume_display_name_windows(path: &Path) -> String {
    let Some(letter) = windows_drive_letter(path) else {
        return "Local Drive".to_string();
    };

    let label = volume_label_from_vol(letter)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Local Disk".to_string());

    format!("{label} ({letter}:)")
}

#[cfg(target_os = "windows")]
fn windows_drive_letter(path: &Path) -> Option<char> {
    let mut components = path.components();
    match components.next()? {
        std::path::Component::Prefix(prefix) => {
            let prefix_str = prefix.as_os_str().to_string_lossy();
            let letter = prefix_str.chars().next()?;
            if letter.is_ascii_alphabetic() {
                Some(letter.to_ascii_uppercase())
            } else {
                None
            }
        }
        _ => None,
    }
}

#[cfg(target_os = "windows")]
fn volume_label_from_vol(letter: char) -> Option<String> {
    let output = std::process::Command::new("cmd")
        .args(["/C", &format!("vol {}:", letter)])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some((_, label)) = line.split_once(" is ") {
            let trimmed = label.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn volume_display_name_linux(path: &Path) -> String {
    if let Some(mount) = mount_point_for_path(path) {
        let mount_str = mount.to_string_lossy();
        if mount_str.starts_with("/media/") || mount_str.starts_with("/mnt/") || mount_str.starts_with("/run/media/") {
            if let Some(name) = mount.file_name().and_then(|n| n.to_str()).filter(|s| !s.is_empty()) {
                return name.to_string();
            }
        }
    }
    "Local Drive".to_string()
}

#[cfg(target_os = "macos")]
fn volume_name_from_diskutil(target: &Path) -> Option<String> {
    let target_arg = target.to_string_lossy();
    let output = std::process::Command::new("diskutil")
        .args(["info", target_arg.as_ref()])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for key in [
        "Volume Name:",
        "Mounted Volume Name:",
        "Device / Media Name:",
    ] {
        if let Some(value) = diskutil_field_value(&stdout, key) {
            return Some(normalize_macos_volume_label(&value));
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn diskutil_field_value(output: &str, key: &str) -> Option<String> {
    let value = output
        .lines()
        .find_map(|line| line.trim_start().strip_prefix(key))?
        .trim();
    if value.is_empty() || value == "Not applicable" {
        return None;
    }
    Some(value.to_string())
}

#[cfg(target_os = "macos")]
fn normalize_macos_volume_label(label: &str) -> String {
    let trimmed = label.trim();
    if let Some(prefix) = trimmed.strip_suffix(" - Data") {
        return prefix.trim().to_string();
    }
    trimmed.to_string()
}

/// Create a new directory under `parent_path` using `base_name`, appending `" 2"`, `" 3"`, … if needed.
#[tauri::command]
pub fn create_unique_directory(app: AppHandle, parent_path: String, base_name: String) -> Result<String, String> {
    let parent = ensure_within_workspace_root(&app, Path::new(&parent_path))?;
    if !parent.is_dir() {
        return Err(format!("Parent is not a directory: {}", parent.display()));
    }
    if base_name.trim().is_empty() {
        return Err("Base folder name is empty.".to_string());
    }
    for suffix in 0u32..10_000 {
        let folder_name = if suffix == 0 {
            base_name.clone()
        } else {
            format!("{} {}", base_name, suffix + 1)
        };
        let dest = parent.join(&folder_name);
        if !dest.exists() {
            fs::create_dir(&dest).map_err(|e| {
                format!(
                    "Could not create folder '{}': {}",
                    dest.display(),
                    e
                )
            })?;
            return Ok(dest.to_string_lossy().to_string());
        }
    }
    Err("Could not find an available folder name.".to_string())
}

/// Create a project folder under `parent_path`, or return it when it already exists as a directory.
#[tauri::command]
pub fn ensure_directory(app: AppHandle, parent_path: String, folder_name: String) -> Result<String, String> {
    let parent = ensure_within_workspace_root(&app, Path::new(&parent_path))?;
    if !parent.is_dir() {
        return Err(format!("Parent is not a directory: {}", parent.display()));
    }
    let name = folder_name.trim();
    if name.is_empty() {
        return Err("Folder name is empty.".to_string());
    }
    let dest = parent.join(name);
    if dest.exists() {
        if dest.is_dir() {
            return Ok(dest.to_string_lossy().to_string());
        }
        return Err(format!(
            "A file named '{}' already exists at this location.",
            name
        ));
    }
    fs::create_dir(&dest).map_err(|e| {
        format!(
            "Could not create folder '{}': {}",
            dest.display(),
            e
        )
    })?;
    Ok(dest.to_string_lossy().to_string())
}

/// Whether a workspace path already exists on disk.
#[tauri::command]
pub fn path_exists(app: AppHandle, path: String) -> Result<bool, String> {
    let p = PathBuf::from(path.trim());
    if p.as_os_str().is_empty() {
        return Ok(false);
    }
    if let Some(parent) = p.parent() {
        if !parent.as_os_str().is_empty() {
            ensure_within_workspace_root(&app, parent)?;
        }
    }
    Ok(p.exists())
}

/// Rename a file or directory on disk (same parent recommended; caller builds full `to_path`).
#[tauri::command]
pub fn rename_fs_path(app: AppHandle, from_path: String, to_path: String) -> Result<(), String> {
    let from = PathBuf::from(&from_path);
    let to = PathBuf::from(&to_path);
    if from.as_os_str().is_empty() || to.as_os_str().is_empty() {
        return Err("Empty path.".to_string());
    }
    if !from.exists() {
        return Err(format!("Nothing exists at '{}'.", from.display()));
    }
    if to.exists() {
        return Err(format!("Already exists: {}", to.display()));
    }
    ensure_within_workspace_root(&app, &from)?;
    let to_parent = to
        .parent()
        .ok_or_else(|| "Target path has no parent directory.".to_string())?;
    ensure_within_workspace_root(&app, to_parent)?;
    fs::rename(&from, &to).map_err(|e| format!("Rename failed: {}", e))
}

/// Copy a user-selected image into `{workspace}/.harvy/assets/` and return a workspace-relative path.
#[tauri::command]
pub fn import_workspace_image(app: AppHandle, source_path: String) -> Result<String, String> {
    let source = PathBuf::from(source_path.trim());
    if !source.is_file() {
        return Err("Selected file is not a readable image.".to_string());
    }

    let root = canonical(&workspace_root_dir(&app)?)?;
    let assets_dir = root.join(".harvy").join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| {
        format!(
            "Could not create image assets folder '{}': {}",
            assets_dir.display(),
            e
        )
    })?;

    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .filter(|e| {
            matches!(
                e.as_str(),
                "png" | "jpg" | "jpeg" | "gif" | "webp" | "heic" | "heif" | "bmp" | "tif" | "tiff"
            )
        })
        .unwrap_or_else(|| "png".to_string());

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let filename = format!("img_{}.{}", stamp, ext);
    let dest = assets_dir.join(&filename);

    fs::copy(&source, &dest).map_err(|e| {
        format!(
            "Could not copy image to '{}': {}",
            dest.display(),
            e
        )
    })?;
    ensure_within_workspace_root(&app, &dest)?;

    Ok(format!(".harvy/assets/{}", filename))
}

#[tauri::command]
pub fn write_text_file(app: AppHandle, path: String, contents: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.as_os_str().is_empty() {
        return Err("Empty path.".to_string());
    }
    let parent = p
        .parent()
        .ok_or_else(|| "Target path has no parent directory.".to_string())?;
    ensure_within_workspace_root(&app, parent)?;
    fs::write(&p, contents).map_err(|e| format!("Could not write file '{}': {}", p.display(), e))
}

fn unique_path_in_dir(dir: &Path, preferred_name: &str) -> Result<PathBuf, String> {
    let preferred = preferred_name.trim();
    if preferred.is_empty() {
        return Err("File name is empty.".to_string());
    }
    let stem = Path::new(preferred)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("img");
    let ext = Path::new(preferred)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| format!(".{}", e))
        .unwrap_or_default();

    for suffix in 0u32..10_000 {
        let name = if suffix == 0 {
            preferred.to_string()
        } else {
            format!("{}{}{}", stem, suffix + 1, ext)
        };
        let dest = dir.join(&name);
        if !dest.exists() {
            return Ok(dest);
        }
    }
    Err("Could not find an available image file name.".to_string())
}

fn ensure_dest_dir(app: &AppHandle, dest_dir: &str) -> Result<PathBuf, String> {
    let dir = ensure_within_workspace_root(app, Path::new(dest_dir))?;
    if !dir.is_dir() {
        return Err(format!("Destination is not a directory: {}", dir.display()));
    }
    Ok(dir)
}

/// Copy a local image file into `dest_dir`, returning the absolute destination path.
#[tauri::command]
pub fn copy_file_into_directory(
    app: AppHandle,
    source_path: String,
    dest_dir: String,
    file_name: Option<String>,
) -> Result<String, String> {
    let source = PathBuf::from(source_path.trim());
    if !source.is_file() {
        return Err(format!("Source is not a readable file: {}", source.display()));
    }
    // Allow reading from workspace assets (and other workspace paths).
    ensure_within_workspace_root(&app, &source)?;

    let dir = ensure_dest_dir(&app, &dest_dir)?;
    let preferred = file_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| {
            source
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
        })
        .unwrap_or_else(|| "img.png".to_string());

    let dest = unique_path_in_dir(&dir, &preferred)?;
    fs::copy(&source, &dest).map_err(|e| {
        format!(
            "Could not copy image to '{}': {}",
            dest.display(),
            e
        )
    })?;
    Ok(dest.to_string_lossy().to_string())
}

/// Write raw bytes into `dest_dir` as `file_name` (unique if needed). Returns absolute path.
#[tauri::command]
pub fn write_bytes_into_directory(
    app: AppHandle,
    dest_dir: String,
    file_name: String,
    contents: Vec<u8>,
) -> Result<String, String> {
    let dir = ensure_dest_dir(&app, &dest_dir)?;
    let dest = unique_path_in_dir(&dir, &file_name)?;
    fs::write(&dest, contents).map_err(|e| {
        format!(
            "Could not write image to '{}': {}",
            dest.display(),
            e
        )
    })?;
    Ok(dest.to_string_lossy().to_string())
}

/// Download a remote image URL into `dest_dir`. Returns absolute destination path.
#[tauri::command]
pub fn download_url_into_directory(
    app: AppHandle,
    url: String,
    dest_dir: String,
    file_name: Option<String>,
) -> Result<String, String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("Only http(s) image URLs can be downloaded.".to_string());
    }

    let dir = ensure_dest_dir(&app, &dest_dir)?;
    let response = reqwest::blocking::get(trimmed)
        .map_err(|e| format!("Could not download image: {}", e))?;
    if !response.status().is_success() {
        return Err(format!(
            "Image download failed with status {}.",
            response.status()
        ));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    let bytes = response
        .bytes()
        .map_err(|e| format!("Could not read downloaded image: {}", e))?;

    let preferred = file_name
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            let ext = if content_type.contains("png") {
                "png".to_string()
            } else if content_type.contains("webp") {
                "webp".to_string()
            } else if content_type.contains("gif") {
                "gif".to_string()
            } else if content_type.contains("jpeg") || content_type.contains("jpg") {
                "jpg".to_string()
            } else {
                Path::new(trimmed)
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.to_ascii_lowercase())
                    .filter(|e| {
                        matches!(
                            e.as_str(),
                            "png" | "jpg" | "jpeg" | "gif" | "webp" | "heic" | "heif" | "bmp" | "tif" | "tiff"
                        )
                    })
                    .unwrap_or_else(|| "jpg".to_string())
            };
            let stamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0);
            format!("img_{}.{}", stamp, ext)
        });

    let dest = unique_path_in_dir(&dir, &preferred)?;
    fs::write(&dest, &bytes).map_err(|e| {
        format!(
            "Could not write downloaded image to '{}': {}",
            dest.display(),
            e
        )
    })?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_workspace_text_file(app: AppHandle, path: String) -> Result<String, String> {
    let requested = PathBuf::from(path);
    let safe_path = ensure_within_workspace_root(&app, &requested)?;

    let bytes = fs::read(&safe_path)
        .map_err(|e| format!("Could not read file '{}': {}", safe_path.display(), e))?;

    match String::from_utf8(bytes.clone()) {
        Ok(text) => Ok(text),
        Err(_) => {
            let text = String::from_utf8_lossy(&bytes).to_string();
            if text.contains('\u{FFFD}') {
                Err("File encoding is not supported for text preview.".to_string())
            } else {
                Ok(text)
            }
        }
    }
}

/// Export Markdown content to a PDF at an absolute path (after Save dialog).
#[tauri::command]
pub fn export_markdown_pdf(app: AppHandle, path: String, markdown: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if p.as_os_str().is_empty() {
        return Err("Empty path.".to_string());
    }
    let parent = p
        .parent()
        .ok_or_else(|| "Target path has no parent directory.".to_string())?;
    ensure_within_workspace_root(&app, parent)?;
    let workspace_root = canonical(&workspace_root_dir(&app)?)?;
    pdf_export::write_markdown_pdf(&path, &markdown, &workspace_root)
}

#[tauri::command]
pub fn get_user_editor_rules_path(app: AppHandle) -> Result<String, String> {
    let path = user_rules_path(&app)?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_user_editor_rules(app: AppHandle) -> Result<Option<String>, String> {
    let path = user_rules_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&path)
        .map_err(|e| format!("Could not read user rules '{}': {}", path.display(), e))?;
    Ok(Some(text))
}

#[tauri::command]
pub fn ensure_user_editor_rules(app: AppHandle, basic_rules_json: String) -> Result<String, String> {
    let path = user_rules_path(&app)?;
    if !path.exists() {
        fs::write(&path, basic_rules_json)
            .map_err(|e| format!("Could not initialize user rules '{}': {}", path.display(), e))?;
    }
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn write_user_editor_rules(app: AppHandle, contents: String) -> Result<(), String> {
    let path = user_rules_path(&app)?;
    fs::write(&path, contents)
        .map_err(|e| format!("Could not write user rules '{}': {}", path.display(), e))
}
