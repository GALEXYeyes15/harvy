import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "../save/saveRuntime";

export type FocusModeWindowSnapshot = {
  fullscreen: boolean;
  alwaysOnTop: boolean;
};

let activeLock: {
  snapshot: FocusModeWindowSnapshot;
  unlistenFocus?: () => void;
} | null = null;

/**
 * Approximate Guided Access for the desktop app:
 * fullscreen + always-on-top + re-focus on blur.
 * Cannot fully block Cmd+Tab / Mission Control (OS-level).
 */
export async function enterFocusModeWindowLock(): Promise<void> {
  if (!isTauriRuntime()) {
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Browser may deny fullscreen without a gesture.
    }
    return;
  }

  if (activeLock) return;

  const win = getCurrentWindow();
  const snapshot: FocusModeWindowSnapshot = {
    fullscreen: await win.isFullscreen().catch(() => false),
    alwaysOnTop: await win.isAlwaysOnTop().catch(() => false),
  };

  try {
    await win.setFullscreen(true);
    await win.setAlwaysOnTop(true);
    await win.setClosable(false);
    await win.setMinimizable(false);
    await win.setFocus();
  } catch (err) {
    console.error("Focus mode window lock failed to apply:", err);
  }

  const unlistenFocus = await win.onFocusChanged(({ payload: focused }) => {
    if (focused) return;
    void win.setFocus().catch(() => undefined);
  });

  activeLock = { snapshot, unlistenFocus };
}

export async function exitFocusModeWindowLock(): Promise<void> {
  if (!isTauriRuntime()) {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // ignore
      }
    }
    return;
  }

  const lock = activeLock;
  activeLock = null;
  if (!lock) return;

  lock.unlistenFocus?.();

  const win = getCurrentWindow();
  try {
    await win.setClosable(true);
    await win.setMinimizable(true);
    await win.setAlwaysOnTop(lock.snapshot.alwaysOnTop);
    await win.setFullscreen(lock.snapshot.fullscreen);
  } catch (err) {
    console.error("Focus mode window lock failed to release:", err);
  }
}

export function isFocusModeWindowLockActive(): boolean {
  return activeLock != null;
}
