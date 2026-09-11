//! Native macOS share sheet (AirDrop, Messages, Mail, …) for a Markdown PDF.

use super::pdf_export::write_markdown_pdf;
use super::read_workspace_root_config;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::AppHandle;

#[derive(Debug, Deserialize)]
pub struct ShareAnchor {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub(crate) fn sanitize_share_file_name(name: &str) -> String {
    let cleaned: String = name
        .trim()
        .chars()
        .map(|c| if "/\\?%*:|\"<>".contains(c) { '-' } else { c })
        .collect();
    let cleaned = cleaned.trim().trim_matches('.').trim();
    let with_pdf = if cleaned.to_ascii_lowercase().ends_with(".pdf") {
        cleaned.to_string()
    } else if cleaned.is_empty() {
        "Podcast Notes.pdf".to_string()
    } else {
        format!("{cleaned}.pdf")
    };
    if with_pdf.trim_matches('.').is_empty() {
        "Podcast Notes.pdf".to_string()
    } else {
        with_pdf
    }
}

fn temp_share_pdf_path(file_name: &str) -> Result<PathBuf, String> {
    let dir = std::env::temp_dir().join("harvy-share");
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create a temp share folder: {}", e))?;
    Ok(dir.join(sanitize_share_file_name(file_name)))
}

#[cfg(target_os = "macos")]
fn show_share_sheet_macos(app: &AppHandle, file_path: &Path, anchor: Option<ShareAnchor>) -> Result<(), String> {
    use objc2::rc::Retained;
    use objc2::runtime::AnyObject;
    use objc2::AnyThread;
    use objc2_app_kit::{NSApplication, NSSharingServicePicker};
    use objc2_foundation::{MainThreadMarker, NSArray, NSPoint, NSRect, NSRectEdge, NSSize, NSString, NSURL};
    use std::cell::RefCell;
    use std::sync::mpsc;

    thread_local! {
        static ACTIVE_PICKER: RefCell<Option<(Retained<NSSharingServicePicker>, PathBuf)>> =
            const { RefCell::new(None) };
    }

    let path = file_path.to_path_buf();
    let (sender, receiver) = mpsc::channel();

    app.run_on_main_thread(move || {
        let result = (|| {
            let mtm = MainThreadMarker::new()
                .ok_or_else(|| "macOS share must run on the main thread.".to_string())?;
            let ns_app = NSApplication::sharedApplication(mtm);
            let window = ns_app
                .keyWindow()
                .or_else(|| ns_app.mainWindow())
                .ok_or_else(|| "Could not find a window to share from.".to_string())?;
            let view = window
                .contentView()
                .ok_or_else(|| "Could not find a view to share from.".to_string())?;

            let path_string = NSString::from_str(&path.to_string_lossy());
            let file_url = NSURL::fileURLWithPath(&path_string);
            let items = NSArray::<AnyObject>::from_retained_slice(&[unsafe {
                Retained::cast_unchecked(file_url)
            }]);
            let picker = unsafe { NSSharingServicePicker::initWithItems(NSSharingServicePicker::alloc(), &items) };

            let bounds = view.bounds();
            let rect = if let Some(anchor) = anchor {
                NSRect::new(
                    NSPoint::new(anchor.x, bounds.size.height - anchor.y - anchor.height),
                    NSSize::new(anchor.width.max(1.0), anchor.height.max(1.0)),
                )
            } else {
                NSRect::new(
                    NSPoint::new(bounds.size.width - 48.0, 24.0),
                    NSSize::new(36.0, 28.0),
                )
            };

            picker.showRelativeToRect_ofView_preferredEdge(rect, &view, NSRectEdge::MinY);

            ACTIVE_PICKER.with(|slot| {
                if let Some((_, previous)) = slot.replace(Some((picker, path.clone()))) {
                    if previous != path {
                        let _ = fs::remove_file(previous);
                    }
                }
            });
            Ok(())
        })();
        let _ = sender.send(result);
    })
    .map_err(|error| error.to_string())?;

    receiver
        .recv()
        .map_err(|error| error.to_string())?
}

#[cfg(not(target_os = "macos"))]
fn show_share_sheet_macos(
    _app: &AppHandle,
    _file_path: &Path,
    _anchor: Option<ShareAnchor>,
) -> Result<(), String> {
    Err("Share is only available in the Harvy desktop app on macOS.".to_string())
}

/// Render Markdown to a temporary PDF and open the macOS share sheet.
#[tauri::command]
pub fn share_markdown(
    app: AppHandle,
    markdown: String,
    title: Option<String>,
    file_name: Option<String>,
    anchor: Option<ShareAnchor>,
) -> Result<(), String> {
    let _ = title;
    let pdf_path = temp_share_pdf_path(file_name.as_deref().unwrap_or("Podcast Notes.pdf"))?;
    let path_str = pdf_path.to_string_lossy().to_string();
    let workspace_root = read_workspace_root_config(&app)?.unwrap_or_else(std::env::temp_dir);

    if let Err(error) = write_markdown_pdf(&path_str, &markdown, &workspace_root) {
        let _ = fs::remove_file(&pdf_path);
        return Err(error);
    }

    let share_result = show_share_sheet_macos(&app, &pdf_path, anchor);
    if share_result.is_err() {
        let _ = fs::remove_file(&pdf_path);
    }
    share_result
}

#[cfg(test)]
mod tests {
    use super::sanitize_share_file_name;

    #[test]
    fn sanitize_share_file_name_keeps_pdf_and_strips_path_chars() {
        assert_eq!(
            sanitize_share_file_name("Why Victims Become / Villains"),
            "Why Victims Become - Villains.pdf"
        );
        assert_eq!(
            sanitize_share_file_name("Notes.pdf"),
            "Notes.pdf"
        );
        assert_eq!(sanitize_share_file_name("   "), "Podcast Notes.pdf");
    }
}
