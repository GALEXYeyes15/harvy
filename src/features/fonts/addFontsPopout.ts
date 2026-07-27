import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { primaryMonitor } from "@tauri-apps/api/window";
import { isTauriRuntime } from "../save/saveRuntime";
import {
  readStoredAppearanceStyleId,
  stageBackgroundRgb,
} from "../../theme/appearanceStyles";
import { readStoredThemeMode, resolveTheme } from "../../theme/themeMode";
import {
  readUserAppearanceFonts,
  writeUserAppearanceFontsFromSync,
  type UserAppearanceFont,
} from "../../theme/userAppearanceFonts";

function stageBackgroundColor(): [number, number, number] {
  const systemDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveTheme(readStoredThemeMode(), systemDark);
  return stageBackgroundRgb(resolved, readStoredAppearanceStyleId());
}

export const FONTS_WINDOW_LABEL = "fonts";
export const FONTS_CATALOG_CHANGED_EVENT = "harvy-fonts-catalog-changed";

function isFontsWindowQuery(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("window") === "fonts";
}

/** True when this webview should render the Add Fonts shell. */
export function isAddFontsWindow(): boolean {
  if (isFontsWindowQuery()) return true;
  if (!isTauriRuntime()) return false;
  try {
    return WebviewWindow.getCurrent().label === FONTS_WINDOW_LABEL;
  } catch {
    return false;
  }
}

async function fontsWindowSize(): Promise<{ width: number; height: number }> {
  const fallback = { width: 1180, height: 780 };
  try {
    const monitor = await primaryMonitor();
    if (!monitor) return fallback;
    const scale = monitor.scaleFactor || 1;
    const logicalWidth = monitor.size.width / scale;
    const logicalHeight = monitor.size.height / scale;
    return {
      width: Math.max(960, Math.round(logicalWidth * 0.72)),
      height: Math.max(640, Math.round(logicalHeight * 0.82)),
    };
  } catch {
    return fallback;
  }
}

/** Open the Add Fonts window, or focus it if already open. */
export async function openAddFontsWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    const url = `${window.location.origin}/?window=fonts`;
    window.open(url, "harvy-add-fonts", "width=920,height=720");
    return;
  }

  const existing = await WebviewWindow.getByLabel(FONTS_WINDOW_LABEL);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const { width, height } = await fontsWindowSize();
  const popout = new WebviewWindow(FONTS_WINDOW_LABEL, {
    url: "/?window=fonts",
    title: "Add Fonts",
    width,
    height,
    minWidth: 860,
    minHeight: 560,
    center: true,
    focus: true,
    resizable: true,
    decorations: true,
    titleBarStyle: "overlay",
    hiddenTitle: true,
    backgroundColor: stageBackgroundColor(),
  });

  await new Promise<void>((resolve, reject) => {
    void popout.once("tauri://created", () => resolve());
    void popout.once("tauri://error", (event) => {
      reject(event.payload instanceof Error ? event.payload : new Error(String(event.payload)));
    });
  });
}

export async function emitFontsCatalogChanged(fonts?: UserAppearanceFont[]): Promise<void> {
  if (!isTauriRuntime()) return;
  await emit(FONTS_CATALOG_CHANGED_EVENT, fonts ?? readUserAppearanceFonts());
}

export async function listenFontsCatalogChanged(
  handler: (fonts: UserAppearanceFont[]) => void,
): Promise<UnlistenFn> {
  return listen<UserAppearanceFont[]>(FONTS_CATALOG_CHANGED_EVENT, (event) => {
    const fonts = Array.isArray(event.payload) ? event.payload : [];
    writeUserAppearanceFontsFromSync(fonts);
    handler(fonts);
  });
}
