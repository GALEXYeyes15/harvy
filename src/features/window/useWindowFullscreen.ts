import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { isTauriRuntime } from "../save/saveRuntime";

/** Tracks native window fullscreen state (Tauri only; false in the browser). */
export function useWindowFullscreen(): boolean {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    const win = getCurrentWindow();
    let unlistenResize: (() => void) | undefined;
    let cancelled = false;

    const sync = async () => {
      try {
        const next = await win.isFullscreen();
        if (!cancelled) setIsFullscreen(next);
      } catch {
        if (!cancelled) setIsFullscreen(false);
      }
    };

    void sync();
    void win.onResized(() => {
      void sync();
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlistenResize = fn;
    });

    return () => {
      cancelled = true;
      unlistenResize?.();
    };
  }, []);

  return isFullscreen;
}
