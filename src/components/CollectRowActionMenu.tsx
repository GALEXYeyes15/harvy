import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

const MENU_GAP_PX = 6;
const VIEWPORT_PADDING_PX = 8;

const MENU_ITEM =
  "w-full px-3 py-1.5 text-left text-[12px] text-ink/88 transition-colors hover:bg-ink/[0.06] dark:text-white/86 dark:hover:bg-white/[0.08]";

type CollectRowActionMenuProps = {
  anchorRef: RefObject<HTMLElement | null>;
  onDelete: () => void;
  onAddToNotes: () => void;
};

type MenuPlacement = "right" | "below" | "above";

export function CollectRowActionMenu({
  anchorRef,
  onDelete,
  onAddToNotes,
}: CollectRowActionMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    placement: MenuPlacement;
  } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const placeMenu = () => {
      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const rightLeft = anchorRect.right + MENU_GAP_PX;
      const rightTop = anchorRect.top + anchorRect.height / 2 - menuRect.height / 2;
      const fitsRight =
        rightLeft + menuRect.width <= viewportWidth - VIEWPORT_PADDING_PX &&
        rightTop >= VIEWPORT_PADDING_PX &&
        rightTop + menuRect.height <= viewportHeight - VIEWPORT_PADDING_PX;

      if (fitsRight) {
        setPosition({ top: rightTop, left: rightLeft, placement: "right" });
        return;
      }

      const belowTop = anchorRect.bottom + MENU_GAP_PX;
      const belowLeft = Math.min(
        Math.max(VIEWPORT_PADDING_PX, anchorRect.right - menuRect.width),
        viewportWidth - menuRect.width - VIEWPORT_PADDING_PX,
      );
      const fitsBelow = belowTop + menuRect.height <= viewportHeight - VIEWPORT_PADDING_PX;

      if (fitsBelow) {
        setPosition({ top: belowTop, left: belowLeft, placement: "below" });
        return;
      }

      const aboveTop = anchorRect.top - menuRect.height - MENU_GAP_PX;
      const aboveLeft = belowLeft;
      setPosition({
        top: Math.max(VIEWPORT_PADDING_PX, aboveTop),
        left: aboveLeft,
        placement: "above",
      });
    };

    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);

    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [anchorRef]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Collect row actions"
      data-collect-row-menu
      className="fixed z-[80] min-w-[8.5rem] rounded-md border border-line/30 bg-stage py-1 shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:border-white/[0.1] dark:bg-[#1e1e1e] dark:shadow-[0_4px_18px_rgba(0,0,0,0.36)]"
      style={
        position
          ? { top: position.top, left: position.left, visibility: "visible" }
          : { top: 0, left: 0, visibility: "hidden" }
      }
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        className={`${MENU_ITEM} hover:text-[#e5484d] dark:hover:text-[#ff6b6b]`}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        Delete
      </button>
      <button
        type="button"
        role="menuitem"
        className={MENU_ITEM}
        onClick={(event) => {
          event.stopPropagation();
          onAddToNotes();
        }}
      >
        Add to Notes
      </button>
    </div>,
    document.body,
  );
}
