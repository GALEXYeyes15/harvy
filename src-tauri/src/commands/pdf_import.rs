//! Extract attributed text from a workspace PDF so Harvy can convert it to Markdown.

use serde::Serialize;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfTextRun {
    pub text: String,
    pub font_size: f64,
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub href: Option<String>,
}

#[cfg(target_os = "macos")]
fn extract_pdf_text_macos(app: &AppHandle, file_path: &str) -> Result<Vec<PdfTextRun>, String> {
    use objc2::rc::autoreleasepool;
    use objc2::AnyThread;
    use objc2_foundation::{NSString, NSURL};
    use objc2_pdf_kit::PDFDocument;
    use std::sync::mpsc;

    let path = file_path.to_string();
    let (sender, receiver) = mpsc::channel();

    app.run_on_main_thread(move || {
        let result = autoreleasepool(|_| {
            let path_string = NSString::from_str(&path);
            let file_url = NSURL::fileURLWithPath(&path_string);
            let document = unsafe { PDFDocument::initWithURL(PDFDocument::alloc(), &file_url) }
                .ok_or_else(|| format!("Could not open this PDF: {}", path))?;

            let mut runs: Vec<PdfTextRun> = Vec::new();
            let count = unsafe { document.pageCount() };
            for index in 0..count {
                let Some(page) = (unsafe { document.pageAtIndex(index) }) else {
                    continue;
                };
                if !runs.is_empty() {
                    runs.push(PdfTextRun {
                        text: "\n\n".to_string(),
                        font_size: 0.0,
                        bold: false,
                        italic: false,
                        underline: false,
                        href: None,
                    });
                }
                if let Some(attributed) = unsafe { page.attributedString() } {
                    runs.extend(runs_from_attributed(&attributed));
                } else if let Some(value) = unsafe { page.string() } {
                    let text = value.to_string();
                    if !text.is_empty() {
                        runs.push(PdfTextRun {
                            text,
                            font_size: 0.0,
                            bold: false,
                            italic: false,
                            underline: false,
                            href: None,
                        });
                    }
                }
            }
            if runs.is_empty() {
                if let Some(value) = unsafe { document.string() } {
                    let text = value.to_string();
                    if !text.is_empty() {
                        runs.push(PdfTextRun {
                            text,
                            font_size: 0.0,
                            bold: false,
                            italic: false,
                            underline: false,
                            href: None,
                        });
                    }
                }
            }
            Ok(runs)
        });
        let _ = sender.send(result);
    })
    .map_err(|error| error.to_string())?;

    receiver
        .recv()
        .map_err(|error| error.to_string())?
}

#[cfg(target_os = "macos")]
fn runs_from_attributed(
    attributed: &objc2_foundation::NSAttributedString,
) -> Vec<PdfTextRun> {
    use objc2_app_kit::{
        NSFont, NSFontAttributeName, NSFontDescriptorSymbolicTraits, NSLinkAttributeName,
        NSUnderlineStyleAttributeName,
    };
    use objc2_foundation::{NSNumber, NSRange};

    let ns_string = attributed.string();
    let length = ns_string.length();
    if length == 0 {
        return Vec::new();
    }

    let mut runs = Vec::new();
    let mut location: usize = 0;
    while location < length {
        let mut effective = NSRange::new(0, 0);
        let attrs =
            unsafe { attributed.attributesAtIndex_effectiveRange(location, &mut effective) };
        if effective.length == 0 {
            location += 1;
            continue;
        }
        let start = location.max(effective.location);
        let end = (effective.location + effective.length).min(length);
        if end <= start {
            location += 1;
            continue;
        }
        let range = NSRange::new(start, end - start);
        let text = ns_string.substringWithRange(range).to_string();

        let mut font_size = 0.0;
        let mut bold = false;
        let mut italic = false;
        if let Some(font_obj) = attrs.objectForKey(unsafe { NSFontAttributeName }) {
            if let Ok(font) = font_obj.downcast::<NSFont>() {
                font_size = font.pointSize() as f64;
                let traits = font.fontDescriptor().symbolicTraits();
                bold = traits.contains(NSFontDescriptorSymbolicTraits::TraitBold);
                italic = traits.contains(NSFontDescriptorSymbolicTraits::TraitItalic);
                let name = font.fontName().to_string().to_lowercase();
                if name.contains("bold")
                    || name.contains("black")
                    || name.contains("heavy")
                    || name.contains("semibold")
                    || name.contains("demibold")
                {
                    bold = true;
                }
                if name.contains("italic") || name.contains("oblique") {
                    italic = true;
                }
            }
        }

        let underline = attrs
            .objectForKey(unsafe { NSUnderlineStyleAttributeName })
            .and_then(|value| value.downcast::<NSNumber>().ok())
            .map(|number| number.integerValue() != 0)
            .unwrap_or(false);

        let href = attrs
            .objectForKey(unsafe { NSLinkAttributeName })
            .and_then(link_from_object);

        if !text.is_empty() {
            runs.push(PdfTextRun {
                text,
                font_size,
                bold,
                italic,
                underline,
                href,
            });
        }
        location = end;
    }
    runs
}

#[cfg(target_os = "macos")]
fn link_from_object(value: objc2::rc::Retained<objc2::runtime::AnyObject>) -> Option<String> {
    use objc2_foundation::{NSString, NSURL};
    if let Ok(url) = value.clone().downcast::<NSURL>() {
        return url.absoluteString().map(|s| s.to_string());
    }
    if let Ok(text) = value.downcast::<NSString>() {
        let href = text.to_string();
        if href.is_empty() {
            return None;
        }
        return Some(href);
    }
    None
}

#[cfg(not(target_os = "macos"))]
fn extract_pdf_text_macos(_app: &AppHandle, _file_path: &str) -> Result<Vec<PdfTextRun>, String> {
    Err("PDF conversion is only available in the Harvy desktop app on macOS.".to_string())
}

/// Return attributed text runs stored in a PDF under the current workspace folder.
#[tauri::command]
pub fn extract_pdf_text(app: AppHandle, path: String) -> Result<Vec<PdfTextRun>, String> {
    let requested = PathBuf::from(path.trim());
    if requested.as_os_str().is_empty() {
        return Err("Empty path.".to_string());
    }
    let safe_path = super::ensure_within_workspace_root(&app, &requested)?;
    let ext = safe_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if !ext.eq_ignore_ascii_case("pdf") {
        return Err("Only PDF files can be converted to Markdown.".to_string());
    }
    if !safe_path.is_file() {
        return Err(format!("Could not read PDF '{}'.", safe_path.display()));
    }
    extract_pdf_text_macos(&app, &safe_path.to_string_lossy())
}
