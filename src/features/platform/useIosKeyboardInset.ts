import { useEffect } from "react";

/** How much of the layout viewport the software keyboard is covering. */
export function keyboardOverlapPx(
  layoutHeight: number,
  viewportHeight: number,
  offsetTop: number,
): number {
  if (!Number.isFinite(layoutHeight) || !Number.isFinite(viewportHeight)) return 0;
  return Math.max(0, Math.round(layoutHeight - viewportHeight - offsetTop));
}

/**
 * Shrink the iPad shell while the keyboard is up.
 * If the web view already resized, the overlap is zero and this does nothing.
 */
export function useIosKeyboardInset(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const root = document.documentElement;
    const sync = () => {
      const offsetTop = Math.max(0, Math.round(viewport.offsetTop));
      const offsetLeft = Math.max(0, Math.round(viewport.offsetLeft));
      root.style.setProperty(
        "--harvy-keyboard-inset",
        `${keyboardOverlapPx(window.innerHeight, viewport.height, viewport.offsetTop)}px`,
      );
      // iPad pans the visual viewport to follow the caret. Track that pan so the
      // shell, toolbar, and sidebars stay on screen while the text scroller moves.
      root.style.setProperty("--harvy-viewport-offset-top", `${offsetTop}px`);
      root.style.setProperty("--harvy-viewport-offset-left", `${offsetLeft}px`);
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    window.addEventListener("scroll", sync, { passive: true });
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      window.removeEventListener("scroll", sync);
      root.style.removeProperty("--harvy-keyboard-inset");
      root.style.removeProperty("--harvy-viewport-offset-top");
      root.style.removeProperty("--harvy-viewport-offset-left");
    };
  }, [enabled]);
}
