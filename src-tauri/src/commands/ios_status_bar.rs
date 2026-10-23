//! iPad status bar (time, date, battery). Hidden while the writing chrome is.
#![cfg(target_os = "ios")]

use objc2::rc::Retained;
use objc2::runtime::Bool;
use objc2::{msg_send, sel, MainThreadMarker};
use objc2_ui_kit::{UIApplication, UIViewController, UIWindowScene};
use tauri::AppHandle;

/// Tao's root view controller answers `prefersStatusBarHidden` from a property
/// whose setter also asks UIKit to update the status bar.
pub fn set_hidden(app: &AppHandle, hidden: bool) -> Result<(), String> {
    app.run_on_main_thread(move || {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let Some(controller) = root_view_controller(mtm) else {
            return;
        };
        let responds: bool =
            unsafe { msg_send![&*controller, respondsToSelector: sel!(setPrefersStatusBarHidden:)] };
        if responds {
            let _: () = unsafe { msg_send![&*controller, setPrefersStatusBarHidden: Bool::new(hidden)] };
        }
    })
    .map_err(|error| format!("Could not change the status bar. {error}"))
}

fn root_view_controller(mtm: MainThreadMarker) -> Option<Retained<UIViewController>> {
    let scenes = UIApplication::sharedApplication(mtm).connectedScenes().allObjects();
    for index in 0..scenes.count() {
        let scene = scenes.objectAtIndex(index);
        let Some(window_scene) = scene.downcast_ref::<UIWindowScene>() else {
            continue;
        };
        let windows = window_scene.windows();
        let window = window_scene.keyWindow().or_else(|| {
            (windows.count() > 0).then(|| windows.objectAtIndex(0))
        });
        if let Some(root) = window.and_then(|window| window.rootViewController()) {
            return Some(root);
        }
    }
    None
}
