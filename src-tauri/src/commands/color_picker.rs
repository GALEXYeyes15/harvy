//! Screen color sampling for the appearance editor eyedropper.
//!
//! WKWebView does not expose the browser EyeDropper API, so on macOS we use
//! AppKit's `NSColorSampler` (system loupe). Other platforms return an error and
//! the frontend falls back to EyeDropper when available.

use tauri::AppHandle;

#[cfg(target_os = "macos")]
fn ns_color_to_hex(color: *mut objc2_app_kit::NSColor) -> Option<String> {
  use objc2_app_kit::NSColorSpace;

  if color.is_null() {
    return None;
  }
  // Safety: NSColorSampler invokes the handler with a valid NSColor or null.
  let color = unsafe { &*color };
  let srgb = NSColorSpace::sRGBColorSpace();
  let converted = color.colorUsingColorSpace(&srgb)?;
  let mut r = 0.0;
  let mut g = 0.0;
  let mut b = 0.0;
  let mut a = 0.0;
  unsafe {
    converted.getRed_green_blue_alpha(&mut r, &mut g, &mut b, &mut a);
  }
  Some(format!(
    "#{:02x}{:02x}{:02x}",
    (r * 255.0).round().clamp(0.0, 255.0) as u8,
    (g * 255.0).round().clamp(0.0, 255.0) as u8,
    (b * 255.0).round().clamp(0.0, 255.0) as u8
  ))
}

/// Opens the system screen color sampler. Returns `null` when the user cancels.
#[tauri::command]
pub async fn pick_screen_color(app: AppHandle) -> Result<Option<String>, String> {
  #[cfg(target_os = "macos")]
  {
    use block2::RcBlock;
    use objc2_app_kit::{NSColor, NSColorSampler};
    use std::sync::{mpsc, Mutex};

    let (tx, rx) = mpsc::sync_channel::<Option<String>>(1);
    let tx = Mutex::new(Some(tx));

    app
      .run_on_main_thread(move || {
        let sampler = NSColorSampler::new();
        let block = RcBlock::new(move |color: *mut NSColor| {
          let hex = ns_color_to_hex(color);
          if let Ok(mut guard) = tx.lock() {
            if let Some(sender) = guard.take() {
              let _ = sender.send(hex);
            }
          }
        });
        // Safety: handler is invoked on the main thread when sampling ends.
        unsafe {
          sampler.showSamplerWithSelectionHandler(&block);
        }
      })
      .map_err(|err| err.to_string())?;

    tauri::async_runtime::spawn_blocking(move || rx.recv())
      .await
      .map_err(|err| err.to_string())?
      .map_err(|err| err.to_string())
  }

  #[cfg(not(target_os = "macos"))]
  {
    let _ = app;
    Err("Screen color picker requires macOS or a browser with EyeDropper support.".into())
  }
}
