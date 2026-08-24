import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getFileMenuHandlers } from "./fileMenuBridge";

function isLikelyMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

/**
 * Installs a native application / window menu with File actions (macOS menu bar when applicable).
 *
 * Save As opens Harvy’s in-app Save As sheet; choosing Where uses the native folder picker.
 */
export async function setupNativeAppMenu(): Promise<void> {
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
      await MenuItem.new({
        id: "file-export-pdf",
        text: "Export as PDF…",
        accelerator: "CmdOrCtrl+Shift+E",
        action: () => {
          void getFileMenuHandlers().exportPdf();
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

  const menu = await Menu.new({ items: [harvy, file, edit] });

  if (isLikelyMac()) {
    await menu.setAsAppMenu();
  } else {
    const win = getCurrentWindow();
    await menu.setAsWindowMenu(win);
  }
}
