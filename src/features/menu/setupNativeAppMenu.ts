import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getFileMenuHandlers } from "./fileMenuBridge";
import { getViewMenuHandlers } from "./viewMenuBridge";

function isLikelyMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

export type NativeAppMenuOptions = {
  /** When true, Research is shown in the workspace and Open Research is enabled. */
  showResearch?: boolean;
  /** When true, End Focus Mode is enabled. */
  focusModeActive?: boolean;
  /** When true, typing has hidden the tabs and Show Tabs is enabled. */
  tabsHidden?: boolean;
  publishEnabled?: boolean;
  podcastNotesEnabled?: boolean;
  podcastNotesRunning?: boolean;
  notionSyncEnabled?: boolean;
  notionSyncRunning?: boolean;
};

/**
 * Installs a native application / window menu (macOS menu bar when applicable).
 *
 * Save As opens Harvy’s in-app Save As sheet; choosing Where uses the native folder picker.
 * Rebuild when Research, Focus, or Export availability changes so items stay in sync.
 */
export async function setupNativeAppMenu(options: NativeAppMenuOptions = {}): Promise<void> {
  const showResearch = options.showResearch ?? true;
  const focusModeActive = options.focusModeActive ?? false;
  const tabsHidden = options.tabsHidden ?? false;
  const publishEnabled = options.publishEnabled ?? false;
  const podcastNotesEnabled = options.podcastNotesEnabled ?? false;
  const podcastNotesRunning = options.podcastNotesRunning ?? false;
  const notionSyncEnabled = options.notionSyncEnabled ?? false;
  const notionSyncRunning = options.notionSyncRunning ?? false;

  const harvy = await Submenu.new({
    text: "Harvy",
    items: [
      await PredefinedMenuItem.new({
        item: { About: null },
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Hide" }),
      await PredefinedMenuItem.new({ item: "HideOthers" }),
      await PredefinedMenuItem.new({ item: "ShowAll" }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Quit" }),
    ],
  });

  const exportMenu = await Submenu.new({
    text: "Export…",
    items: [
      await MenuItem.new({
        id: "file-export-pdf",
        text: "Export as PDF…",
        accelerator: "CmdOrCtrl+Shift+E",
        action: () => {
          void getFileMenuHandlers().exportPdf();
        },
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await MenuItem.new({
        id: "file-publish",
        text: "Copy, Sync, + Publish",
        enabled: publishEnabled,
        action: () => {
          void getFileMenuHandlers().publish();
        },
      }),
      await MenuItem.new({
        id: "file-podcast-notes",
        text: podcastNotesRunning ? "Export Podcast Notes…" : "Export Podcast Notes",
        enabled: podcastNotesEnabled && !podcastNotesRunning,
        action: () => {
          void getFileMenuHandlers().podcastNotesPdf();
        },
      }),
      await MenuItem.new({
        id: "file-sync-notion",
        text: notionSyncRunning ? "Syncing with Notion…" : "Sync with Notion",
        enabled: notionSyncEnabled && !notionSyncRunning,
        action: () => {
          void getFileMenuHandlers().syncWithNotion();
        },
      }),
    ],
  });

  const file = await Submenu.new({
    text: "File",
    items: [
      await MenuItem.new({
        id: "file-new-markdown",
        text: "New Markdown File…",
        action: () => {
          void getFileMenuHandlers().newMarkdownFile();
        },
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await MenuItem.new({
        id: "file-copy-document",
        text: "Copy",
        action: () => {
          void getFileMenuHandlers().copyDocument();
        },
      }),
      await MenuItem.new({
        id: "file-save",
        text: "Save",
        accelerator: "CmdOrCtrl+S",
        action: () => {
          void getFileMenuHandlers().save();
        },
      }),
      await MenuItem.new({
        id: "file-save-as",
        text: "Save As…",
        accelerator: "CmdOrCtrl+Shift+S",
        action: () => {
          void getFileMenuHandlers().saveAs();
        },
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      exportMenu,
      await PredefinedMenuItem.new({ item: "Separator" }),
      await MenuItem.new({
        id: "file-print",
        text: "Print…",
        accelerator: "CmdOrCtrl+P",
        action: () => {
          void getFileMenuHandlers().print();
        },
      }),
    ],
  });

  const edit = await Submenu.new({
    text: "Edit",
    items: [
      await PredefinedMenuItem.new({ item: "Undo" }),
      await PredefinedMenuItem.new({ item: "Redo" }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await PredefinedMenuItem.new({ item: "Cut" }),
      await PredefinedMenuItem.new({ item: "Copy" }),
      await PredefinedMenuItem.new({ item: "Paste" }),
      await PredefinedMenuItem.new({ item: "SelectAll" }),
    ],
  });

  const view = await Submenu.new({
    text: "View",
    items: [
      await MenuItem.new({
        id: "view-notes",
        text: "Notes",
        accelerator: "CmdOrCtrl+N",
        action: () => {
          void getViewMenuHandlers().openNotes();
        },
      }),
      await MenuItem.new({
        id: "view-write",
        text: "Write",
        accelerator: "CmdOrCtrl+W",
        action: () => {
          getViewMenuHandlers().openWrite();
        },
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await CheckMenuItem.new({
        id: "view-show-research",
        text: "Show Research",
        checked: showResearch,
        action: () => {
          getViewMenuHandlers().setShowResearch(!showResearch);
        },
      }),
      await MenuItem.new({
        id: "view-open-research",
        text: "Open Research",
        accelerator: "CmdOrCtrl+R",
        enabled: showResearch,
        action: () => {
          getViewMenuHandlers().openResearch();
        },
      }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      // AppShell also handles Shift+Esc in the webview; both actions are idempotent.
      await MenuItem.new({
        id: "view-shift-esc",
        text: focusModeActive ? "End Focus Mode" : "Show Tabs",
        accelerator: "Shift+Escape",
        enabled: focusModeActive || tabsHidden,
        action: () => {
          if (focusModeActive) getViewMenuHandlers().endFocusMode();
          else getViewMenuHandlers().showTabs();
        },
      }),
    ],
  });

  const focus = await Submenu.new({
    text: "Focus",
    items: [
      await MenuItem.new({
        id: "focus-open",
        text: "Focus Mode…",
        action: () => {
          getViewMenuHandlers().openFocusMode();
        },
      }),
      await MenuItem.new({
        id: "focus-end",
        text: "End Focus Mode",
        enabled: focusModeActive,
        action: () => {
          getViewMenuHandlers().endFocusMode();
        },
      }),
    ],
  });

  const menu = await Menu.new({ items: [harvy, file, edit, view, focus] });

  if (isLikelyMac()) {
    await menu.setAsAppMenu();
  } else {
    const win = getCurrentWindow();
    await menu.setAsWindowMenu(win);
  }
}
