import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "../save/saveRuntime";

const INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, option, label, [role="button"], [role="tab"], [role="menuitem"], [contenteditable="true"], [data-no-window-drag]';

function isMacPlatform(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isInWindowDragZone(target: Element): boolean {
  const zone = target.closest("[data-harvy-window-drag]");
  return Boolean(zone && zone.getAttribute("data-harvy-window-drag") !== "false");
}

/**
 * Drag any empty chrome inside `[data-harvy-window-drag]`.
 * Uses `closest()` so padding/gaps work even when e.target is a nested wrapper
 * (Tauri’s built-in `data-tauri-drag-region` only checks e.target itself).
 */
export function setupWindowDragRegions(): () => void {
  if (!isTauriRuntime() || typeof document === "undefined") {
    return () => {};
  }

  let doubleClickX = 0;
  let doubleClickY = 0;

  const onMouseDown = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    if (!isInWindowDragZone(target)) return;

    // macOS: zoom on mouseup so a drag after double-click can cancel it.
    if (event.detail === 2 && isMacPlatform()) {
      doubleClickX = event.clientX;
      doubleClickY = event.clientY;
      return;
    }

    if (event.detail === 2) {
      event.preventDefault();
      void getCurrentWindow()
        .toggleMaximize()
        .catch((err) => console.error("Window maximize failed:", err));
      return;
    }

    if (event.detail === 1) {
      event.preventDefault();
      void getCurrentWindow()
        .startDragging()
        .catch((err) => console.error("Window drag failed:", err));
    }
  };

  const onMouseUp = (event: MouseEvent) => {
    if (!isMacPlatform() || event.button !== 0 || event.detail !== 2) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest(INTERACTIVE_SELECTOR)) return;
    if (!isInWindowDragZone(target)) return;
    if (event.clientX !== doubleClickX || event.clientY !== doubleClickY) return;

    void getCurrentWindow()
      .toggleMaximize()
      .catch((err) => console.error("Window maximize failed:", err));
  };

  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mouseup", onMouseUp);
  return () => {
    document.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mouseup", onMouseUp);
  };
}
