import {
  beginSidebarImageDrag,
  dispatchSidebarImageDrop,
  endSidebarImageDrag,
} from "./imageDrop";

const DRAG_THRESHOLD_PX = 6;

type PointerDownLike = Pick<PointerEvent, "button" | "clientX" | "clientY">;

/**
 * Pointer-based drag from the workspace sidebar.
 * HTML5 DnD cannot drop into the editor while Tauri `dragDropEnabled` is on
 * (needed for Finder file paths), so we simulate drag/drop ourselves.
 */
export function armSidebarImagePointerDrag(
  event: PointerDownLike,
  absolutePath: string,
  fileName: string,
): void {
  if (event.button !== 0) return;

  const startX = event.clientX;
  const startY = event.clientY;
  let dragging = false;
  let ghost: HTMLDivElement | null = null;

  const removeGhost = () => {
    ghost?.remove();
    ghost = null;
    document.body.classList.remove("harvy-sidebar-image-dragging");
  };

  const moveGhost = (clientX: number, clientY: number) => {
    if (!ghost) return;
    ghost.style.transform = `translate(${clientX + 12}px, ${clientY + 12}px)`;
  };

  const onMove = (ev: PointerEvent) => {
    if (!dragging) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD_PX) return;
      dragging = true;
      beginSidebarImageDrag(absolutePath);
      document.body.classList.add("harvy-sidebar-image-dragging");
      ghost = document.createElement("div");
      ghost.setAttribute("aria-hidden", "true");
      ghost.textContent = fileName;
      ghost.className =
        "pointer-events-none fixed left-0 top-0 z-[400] max-w-[220px] truncate rounded-md bg-page px-2.5 py-1.5 text-[12px] text-ink shadow-[0_10px_28px_-12px_rgba(0,0,0,0.45)] ring-1 ring-ink/10 dark:ring-white/10";
      document.body.appendChild(ghost);
      moveGhost(ev.clientX, ev.clientY);
    } else {
      moveGhost(ev.clientX, ev.clientY);
    }
  };

  const onUp = (ev: PointerEvent) => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    removeGhost();

    if (!dragging) {
      endSidebarImageDrag();
      return;
    }

    // Suppress the click that follows a successful drag.
    const suppressClick = (clickEvent: MouseEvent) => {
      clickEvent.preventDefault();
      clickEvent.stopPropagation();
      window.removeEventListener("click", suppressClick, true);
    };
    window.addEventListener("click", suppressClick, true);
    window.setTimeout(() => window.removeEventListener("click", suppressClick, true), 0);

    dispatchSidebarImageDrop(absolutePath, ev.clientX, ev.clientY);
    endSidebarImageDrag();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}
