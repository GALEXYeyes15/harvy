//! Native print dialog. WKWebView ignores `window.print()` from the app menu
//! and silently no-ops iframe print, so macOS uses PDFKit.

use super::pdf_export::write_markdown_pdf;
use super::read_workspace_root_config;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::AppHandle;

#[cfg(target_os = "macos")]
fn print_pdf_file_macos(app: &AppHandle, file_path: &str, title: Option<&str>) -> Result<(), String> {
    use objc2::rc::autoreleasepool;
    use objc2::AnyThread;
    use objc2_app_kit::NSPrintInfo;
    use objc2_foundation::{MainThreadMarker, NSString, NSURL};
    use objc2_pdf_kit::{PDFDocument, PDFPrintScalingMode};
    use std::sync::mpsc;

    let path = file_path.to_string();
    let job_title = title.map(str::to_string);
    let (sender, receiver) = mpsc::channel();

    app.run_on_main_thread(move || {
        let result = autoreleasepool(|_| {
            let mtm = MainThreadMarker::new()
                .ok_or_else(|| "macOS print must run on the main thread.".to_string())?;

            let path_string = NSString::from_str(&path);
            let file_url = NSURL::fileURLWithPath(&path_string);
            let document = unsafe { PDFDocument::initWithURL(PDFDocument::alloc(), &file_url) }
                .ok_or_else(|| format!("Could not open PDF for printing: {}", path))?;

            let print_info = NSPrintInfo::sharedPrintInfo();
            let print_operation = unsafe {
                document.printOperationForPrintInfo_scalingMode_autoRotate(
                    Some(&print_info),
                    PDFPrintScalingMode::PageScaleDownToFit,
                    true,
                    mtm,
                )
            }
            .ok_or_else(|| "Could not create the print dialog.".to_string())?;

            if let Some(job) = job_title.as_deref() {
                print_operation.setJobTitle(Some(&NSString::from_str(job)));
            }
            print_operation.setShowsPrintPanel(true);
            print_operation.setShowsProgressPanel(true);
            let _ = print_operation.runOperation();
            Ok(())
        });
        let _ = sender.send(result);
    })
    .map_err(|error| error.to_string())?;

    receiver
        .recv()
        .map_err(|error| error.to_string())?
}

#[cfg(not(target_os = "macos"))]
fn print_pdf_file_macos(_app: &AppHandle, _file_path: &str, _title: Option<&str>) -> Result<(), String> {
    Err("Print is only available in the Harvy desktop app on macOS.".to_string())
}

fn temp_print_pdf_path() -> Result<PathBuf, String> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join("harvy-print");
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create a temp print folder: {}", e))?;
    Ok(dir.join(format!("harvy-print-{}.pdf", stamp)))
}

/// Render Markdown to a temporary PDF and open the system print dialog.
#[tauri::command]
pub fn print_markdown(app: AppHandle, markdown: String, title: Option<String>) -> Result<(), String> {
    let pdf_path = temp_print_pdf_path()?;
    let path_str = pdf_path.to_string_lossy().to_string();
    let workspace_root = read_workspace_root_config(&app)?.unwrap_or_else(std::env::temp_dir);

    let write_result = write_markdown_pdf(&path_str, &markdown, &workspace_root);
    if let Err(error) = write_result {
        let _ = fs::remove_file(&pdf_path);
        return Err(error);
    }

    let print_result = print_pdf_file_macos(&app, &path_str, title.as_deref());
    let _ = fs::remove_file(&pdf_path);
    print_result
}
