import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { primaryMonitor } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isTauriRuntime } from "../save/saveRuntime";
import { readStoredThemeMode, resolveTheme } from "../../theme/themeMode";

/** Match `--color-stage` so the macOS title bar blends with the Notes body. */
function stageBackgroundColor(): [number, number, number] {
  const systemDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = resolveTheme(readStoredThemeMode(), systemDark) === "dark";
  return dark ? [26, 26, 26] : [250, 247, 242];
}

export const NOTES_WINDOW_LABEL = "notes";

/** Main → pop-out: full notes snapshot for the active document. */
export const NOTES_STATE_EVENT = "harvy-notes-state";
/** Pop-out → main: user edited notes in the expanded window. */
export const NOTES_UPDATE_EVENT = "harvy-notes-update";
/** Pop-out → main: request the latest snapshot after mount. */
export const NOTES_REQUEST_EVENT = "harvy-notes-request-state";

export type NotesPopoutStatePayload = {
  notes: string;
  documentTitle: string;
};

export type NotesPopoutUpdatePayload = {
  notes: string;
};

function isNotesWindowQuery(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("window") === "notes";
}

/** True when this webview should render the Notes pop-out shell. */
export function isNotesPopoutWindow(): boolean {
  if (isNotesWindowQuery()) return true;
  if (!isTauriRuntime()) return false;
  try {
    return WebviewWindow.getCurrent().label === NOTES_WINDOW_LABEL;
  } catch {
    return false;
  }
}

async function notesWindowSize(): Promise<{ width: number; height: number }> {
  const fallback = { width: 1100, height: 780 };
  try {
    const monitor = await primaryMonitor();
    if (!monitor) return fallback;
    const scale = monitor.scaleFactor || 1;
    const logicalWidth = monitor.size.width / scale;
    const logicalHeight = monitor.size.height / scale;
    return {
      width: Math.max(640, Math.round(logicalWidth * 0.85)),
      height: Math.max(480, Math.round(logicalHeight * 0.85)),
    };
  } catch {
    return fallback;
  }
}

/** Open the Notes pop-out, or focus it if already open. */
export async function openNotesPopoutWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    window.alert("Expanding Notes requires the Harvy desktop app.");
    return;
  }

  const existing = await WebviewWindow.getByLabel(NOTES_WINDOW_LABEL);
  if (existing) {
    await existing.setFocus();
    await emit(NOTES_REQUEST_EVENT);
    return;
  }

  const { width, height } = await notesWindowSize();
  const popout = new WebviewWindow(NOTES_WINDOW_LABEL, {
    url: "/?window=notes",
    title: "Notes",
    width,
    height,
    minWidth: 520,
    minHeight: 400,
    center: true,
    focus: true,
    resizable: true,
    decorations: true,
    titleBarStyle: "Overlay",
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

/** Toggle the Notes pop-out open/closed. */
export async function toggleNotesPopoutWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    window.alert("Expanding Notes requires the Harvy desktop app.");
    return;
  }

  const existing = await WebviewWindow.getByLabel(NOTES_WINDOW_LABEL);
  if (existing) {
    await existing.close();
    return;
  }
  await openNotesPopoutWindow();
}

export async function emitNotesPopoutState(payload: NotesPopoutStatePayload): Promise<void> {
  if (!isTauriRuntime()) return;
  await emit(NOTES_STATE_EVENT, payload);
}

export async function emitNotesPopoutUpdate(payload: NotesPopoutUpdatePayload): Promise<void> {
  if (!isTauriRuntime()) return;
  await emit(NOTES_UPDATE_EVENT, payload);
}

export async function emitNotesPopoutRequest(): Promise<void> {
  if (!isTauriRuntime()) return;
  await emit(NOTES_REQUEST_EVENT);
}

export async function listenNotesPopoutState(
  handler: (payload: NotesPopoutStatePayload) => void,
): Promise<UnlistenFn> {
  return listen<NotesPopoutStatePayload>(NOTES_STATE_EVENT, (event) => {
    handler(event.payload);
  });
}

export async function listenNotesPopoutUpdate(
  handler: (payload: NotesPopoutUpdatePayload) => void,
): Promise<UnlistenFn> {
  return listen<NotesPopoutUpdatePayload>(NOTES_UPDATE_EVENT, (event) => {
    handler(event.payload);
  });
}

export async function listenNotesPopoutRequest(handler: () => void): Promise<UnlistenFn> {
  return listen(NOTES_REQUEST_EVENT, () => {
    handler();
  });
}
