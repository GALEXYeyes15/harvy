import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";

/** Current top safe-area inset, which on iPad is the status bar's height. */
function measureSafeTopPx(): number {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top, 0px)";
  document.body.appendChild(probe);
  const px = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return px;
}

/** Resolve once the safe-area inset has caught up with the status bar, or after a second. */
function waitForSafeTop(done: (px: number) => boolean, isCancelled: () => boolean): Promise<void> {
  const deadline = performance.now() + 1000;
  return new Promise((resolve) => {
    const check = () => {
      if (isCancelled() || done(measureSafeTopPx()) || performance.now() > deadline) resolve();
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

/** Apply a shell/pad swap without the scroller's padding animation, so the text cannot slide. */
function swapWithoutSliding(root: HTMLElement, apply: () => void) {
  root.classList.add("harvy-status-bar-swap");
  apply();
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.classList.remove("harvy-status-bar-swap")),
  );
}

/**
 * Hide the iPad status bar (time, date, battery) along with the writing chrome.
 * While it is hidden the shell runs to the top of the screen, and the status bar's
 * height moves into the scroller's top pad (`--harvy-status-bar-pad`), so the text
 * stays put but scrolls right up to the edge.
 */
export function useIosStatusBar(enabled: boolean, hidden: boolean) {
  const shouldHide = enabled && hidden;

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const root = document.documentElement;
    let cancelled = false;
    const isCancelled = () => cancelled;

    if (shouldHide) {
      const statusBarPx = measureSafeTopPx();
      // Hold the shell where it is until the inset actually drops, then swap in one write.
      root.style.setProperty("--harvy-safe-top", `${statusBarPx}px`);
      void invoke("set_status_bar_hidden", { hidden: true })
        .catch(() => {})
        .then(() => waitForSafeTop((px) => px === 0, isCancelled))
        .then(() => {
          if (cancelled) return;
          swapWithoutSliding(root, () => {
            root.style.setProperty("--harvy-safe-top", "0px");
            root.style.setProperty("--harvy-status-bar-pad", `${statusBarPx}px`);
          });
        });
    } else {
      // Keep the shell at the top until the status bar is back, then hand the space back.
      void invoke("set_status_bar_hidden", { hidden: false })
        .catch(() => {})
        .then(() => waitForSafeTop((px) => px > 0, isCancelled))
        .then(() => {
          if (cancelled) return;
          swapWithoutSliding(root, () => {
            root.style.removeProperty("--harvy-safe-top");
            root.style.removeProperty("--harvy-status-bar-pad");
          });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [enabled, shouldHide]);

  useEffect(() => {
    if (!enabled) return;
    return () => {
      const root = document.documentElement;
      root.style.removeProperty("--harvy-safe-top");
      root.style.removeProperty("--harvy-status-bar-pad");
      void invoke("set_status_bar_hidden", { hidden: false }).catch(() => {});
    };
  }, [enabled]);
}
