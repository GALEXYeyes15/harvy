//! iPad folder picker. The dialog plugin does not open directories on iOS.
#![cfg(target_os = "ios")]

use objc2::runtime::{Bool, ProtocolObject};
use objc2::{define_class, msg_send, DefinedClass, MainThreadMarker, MainThreadOnly};
use objc2_foundation::{
    NSArray, NSData, NSFileManager, NSObject, NSObjectProtocol, NSSearchPathDirectory,
    NSSearchPathDomainMask, NSString, NSURL, NSURLBookmarkCreationOptions,
    NSURLBookmarkResolutionOptions,
};
use objc2_ui_kit::{
    UIApplication, UIDocumentPickerDelegate, UIDocumentPickerViewController, UIViewController,
    UIWindow, UIWindowScene,
};
use objc2_uniform_type_identifiers::UTType;
use std::cell::RefCell;
use std::sync::{mpsc, Mutex};
use tauri::AppHandle;

static ACCESSED_FOLDERS: Mutex<Vec<objc2::rc::Retained<NSURL>>> = Mutex::new(Vec::new());

struct FolderPickerIvars {
    sender: Mutex<Option<mpsc::Sender<Result<Option<String>, String>>>>,
}

define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[ivars = FolderPickerIvars]
    struct HarvyFolderPickerDelegate;

    unsafe impl NSObjectProtocol for HarvyFolderPickerDelegate {}

    #[allow(deprecated)]
    unsafe impl UIDocumentPickerDelegate for HarvyFolderPickerDelegate {
        #[unsafe(method(documentPicker:didPickDocumentsAtURLs:))]
        fn documentPicker_didPickDocumentsAtURLs(
            &self,
            _controller: &UIDocumentPickerViewController,
            urls: &NSArray<NSURL>,
        ) {
            self.accept_urls(urls);
        }

        #[unsafe(method(documentPickerWasCancelled:))]
        fn documentPickerWasCancelled(&self, _controller: &UIDocumentPickerViewController) {
            self.finish(Ok(None));
        }

        #[unsafe(method(documentPicker:didPickDocumentAtURL:))]
        fn documentPicker_didPickDocumentAtURL(
            &self,
            controller: &UIDocumentPickerViewController,
            url: &NSURL,
        ) {
            let _ = controller;
            let urls = NSArray::from_slice(&[url]);
            self.accept_urls(&urls);
        }
    }
);

impl HarvyFolderPickerDelegate {
    fn new(
        mtm: MainThreadMarker,
        sender: mpsc::Sender<Result<Option<String>, String>>,
    ) -> objc2::rc::Retained<Self> {
        let this = Self::alloc(mtm).set_ivars(FolderPickerIvars {
            sender: Mutex::new(Some(sender)),
        });
        unsafe { msg_send![super(this), init] }
    }

    fn accept_urls(&self, urls: &NSArray<NSURL>) {
        let Some(url) = first_url(urls) else {
            self.finish(Ok(None));
            return;
        };
        if !unsafe { url.startAccessingSecurityScopedResource() } {
            self.finish(Err("Harvy could not access that folder.".to_string()));
            return;
        }
        remember_folder(&url);
        save_bookmark(&url);
        let path = url
            .path()
            .map(|value| value.to_string())
            .filter(|value| !value.is_empty());
        self.finish(Ok(path));
    }

    fn finish(&self, result: Result<Option<String>, String>) {
        let sender = self
            .ivars()
            .sender
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .take();
        if let Some(sender) = sender {
            let _ = sender.send(result);
        }
        ACTIVE_DELEGATE.with(|slot| {
            slot.borrow_mut().take();
        });
    }
}

thread_local! {
    static ACTIVE_DELEGATE: RefCell<Option<objc2::rc::Retained<HarvyFolderPickerDelegate>>> =
        const { RefCell::new(None) };
}

fn first_url(urls: &NSArray<NSURL>) -> Option<objc2::rc::Retained<NSURL>> {
    if urls.count() == 0 {
        None
    } else {
        Some(urls.objectAtIndex(0))
    }
}

fn remember_folder(url: &NSURL) {
    let retained = unsafe { objc2::rc::Retained::retain(url as *const NSURL as *mut NSURL) };
    if let Some(retained) = retained {
        ACCESSED_FOLDERS
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .push(retained);
    }
}

fn directory_url(directory: NSSearchPathDirectory) -> Option<objc2::rc::Retained<NSURL>> {
    let urls = NSFileManager::defaultManager().URLsForDirectory_inDomains(
        directory,
        NSSearchPathDomainMask::UserDomainMask,
    );
    first_url(&urls)
}

fn bookmark_store() -> Option<objc2::rc::Retained<NSURL>> {
    let support = directory_url(NSSearchPathDirectory::ApplicationSupportDirectory)?;
    let directory =
        support.URLByAppendingPathComponent_isDirectory(&NSString::from_str("Harvy"), true)?;
    let _ = unsafe {
        NSFileManager::defaultManager()
            .createDirectoryAtURL_withIntermediateDirectories_attributes_error(
                &directory,
                true,
                None,
            )
    };
    directory.URLByAppendingPathComponent(&NSString::from_str("folder-bookmarks"))
}

fn save_bookmark(url: &NSURL) {
    let Ok(bookmark) = url.bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
        NSURLBookmarkCreationOptions::MinimalBookmark,
        None,
        None,
    ) else {
        return;
    };
    let Some(store) = bookmark_store() else {
        return;
    };
    let mut bookmarks = Vec::new();
    if let Some(existing) = unsafe { NSArray::<NSObject>::arrayWithContentsOfURL(&store) } {
        for index in 0..existing.count() {
            if let Ok(data) = existing.objectAtIndex(index).downcast::<NSData>() {
                bookmarks.push(data);
            }
        }
    }
    bookmarks.push(bookmark);
    let array = NSArray::from_retained_slice(&bookmarks);
    let _ = unsafe { array.writeToURL_atomically(&store, true) };
}

pub fn restore_access() {
    static ONCE: std::sync::Once = std::sync::Once::new();
    ONCE.call_once(|| {
        let Some(store) = bookmark_store() else {
            return;
        };
        let Some(stored) = (unsafe { NSArray::<NSObject>::arrayWithContentsOfURL(&store) }) else {
            return;
        };
        let mut refreshed = Vec::new();
        for index in 0..stored.count() {
            let Ok(bookmark) = stored.objectAtIndex(index).downcast::<NSData>() else {
                continue;
            };
            let mut stale = Bool::NO;
            let Ok(url) = (unsafe {
                NSURL::URLByResolvingBookmarkData_options_relativeToURL_bookmarkDataIsStale_error(
                    &bookmark,
                    NSURLBookmarkResolutionOptions::WithoutUI,
                    None,
                    &mut stale,
                )
            }) else {
                continue;
            };
            if !unsafe { url.startAccessingSecurityScopedResource() } {
                continue;
            }
            remember_folder(&url);
            if stale.as_bool() {
                if let Ok(updated) = url
                    .bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
                        NSURLBookmarkCreationOptions::MinimalBookmark,
                        None,
                        None,
                    )
                {
                    refreshed.push(updated);
                    continue;
                }
            }
            refreshed.push(bookmark);
        }
        if !refreshed.is_empty() {
            let array = NSArray::from_retained_slice(&refreshed);
            let _ = unsafe { array.writeToURL_atomically(&store, true) };
        }
    });
}

fn top_view_controller(mut controller: objc2::rc::Retained<UIViewController>) -> objc2::rc::Retained<UIViewController> {
    while let Some(presented) = controller.presentedViewController() {
        controller = presented;
    }
    controller
}

fn presenter(mtm: MainThreadMarker) -> Option<objc2::rc::Retained<UIViewController>> {
    let application = UIApplication::sharedApplication(mtm);
    let scenes = application.connectedScenes().allObjects();
    for index in 0..scenes.count() {
        let scene = scenes.objectAtIndex(index);
        let Some(window_scene) = scene.downcast_ref::<UIWindowScene>() else {
            continue;
        };
        let window = window_scene
            .keyWindow()
            .or_else(|| first_window(window_scene.windows()));
        let Some(window) = window else {
            continue;
        };
        if let Some(root) = window.rootViewController() {
            return Some(top_view_controller(root));
        }
    }
    None
}

fn first_window(windows: objc2::rc::Retained<NSArray<UIWindow>>) -> Option<objc2::rc::Retained<UIWindow>> {
    if windows.count() == 0 {
        None
    } else {
        Some(windows.objectAtIndex(0))
    }
}

fn starting_directory(default_path: Option<String>) -> Option<objc2::rc::Retained<NSURL>> {
    if let Some(path) = default_path.filter(|path| !path.trim().is_empty()) {
        let ns_path = NSString::from_str(&path);
        let mut is_directory = Bool::NO;
        let exists = unsafe {
            NSFileManager::defaultManager().fileExistsAtPath_isDirectory(&ns_path, &mut is_directory)
        };
        if exists && is_directory.as_bool() {
            return Some(NSURL::fileURLWithPath_isDirectory(&ns_path, true));
        }
    }

    let documents = directory_url(NSSearchPathDirectory::DocumentDirectory)?;
    let workspace =
        documents.URLByAppendingPathComponent_isDirectory(&NSString::from_str("Workspace"), true)?;
    let _ = unsafe {
        NSFileManager::defaultManager()
            .createDirectoryAtURL_withIntermediateDirectories_attributes_error(
                &workspace,
                true,
                None,
            )
    };
    Some(documents)
}

fn present_picker(default_path: Option<String>, sender: mpsc::Sender<Result<Option<String>, String>>) {
    let Some(mtm) = MainThreadMarker::new() else {
        let _ = sender.send(Err("Folder picker must be opened on the main thread.".to_string()));
        return;
    };
    let Some(presenter) = presenter(mtm) else {
        let _ = sender.send(Err("Could not open the folder picker.".to_string()));
        return;
    };

    let Some(folder_type) = UTType::typeWithIdentifier(&NSString::from_str("public.folder")) else {
        let _ = sender.send(Err("Could not open the folder picker.".to_string()));
        return;
    };
    let types = NSArray::from_slice(&[&*folder_type]);
    // asCopy = false keeps the original folder so later reads and writes
    // use the security-scoped URL. The system chooses the sheet style;
    // forcing a form sheet leaves the Files browser blank on iPad.
    let picker = UIDocumentPickerViewController::initForOpeningContentTypes_asCopy(
        UIDocumentPickerViewController::alloc(mtm),
        &types,
        false,
    );
    picker.setAllowsMultipleSelection(false);
    if let Some(directory) = starting_directory(default_path) {
        picker.setDirectoryURL(Some(&directory));
    }

    let delegate = HarvyFolderPickerDelegate::new(mtm, sender);
    picker.setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
    ACTIVE_DELEGATE.with(|slot| {
        *slot.borrow_mut() = Some(delegate);
    });
    presenter.presentViewController_animated_completion(&picker, true, None);
}

pub fn open_picker(
    app: &AppHandle,
    default_path: Option<String>,
) -> Result<mpsc::Receiver<Result<Option<String>, String>>, String> {
    restore_access();
    let (sender, receiver) = mpsc::channel();
    app.run_on_main_thread(move || present_picker(default_path, sender))
        .map_err(|error| format!("Could not open the folder picker. {error}"))?;
    Ok(receiver)
}
