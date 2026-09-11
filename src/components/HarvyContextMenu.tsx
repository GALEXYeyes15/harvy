import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import {
  closeHarvyContextMenu,
  ensureHarvyContextMenuMount,
  findScrollableAncestors,
  getHarvyContextMenuMount,
  HARVY_CONTEXT_MENU_CLASS,
  HARVY_CONTEXT_MENU_DIVIDER_CLASS,
  isHarvyContextMenuAnchorVisible,
  placeHarvyContextMenu,
  type HarvyContextMenuAnchorRange,
  type HarvyContextMenuPlacement,
} from "../features/editor/harvyContextMenu";

type HarvyContextMenuShellProps = {
  children: ReactNode;
  menuRef?: RefObject<HTMLDivElement | null>;
  role?: string;
  ariaLabel?: string;
  className?: string;
  onMouseDown?: (e: React.MouseEvent) => void;
  onPointerEnter?: (e: React.PointerEvent) => void;
  onPointerLeave?: (e: React.PointerEvent) => void;
};

export function HarvyContextMenuShell({
  children,
  menuRef,
  role = "menu",
  ariaLabel,
  className,
  onMouseDown,
  onPointerEnter,
  onPointerLeave,
}: HarvyContextMenuShellProps) {
  return (
    <div
      ref={menuRef}
      className={[HARVY_CONTEXT_MENU_CLASS, className].filter(Boolean).join(" ")}
      role={role}
      aria-label={ariaLabel}
      onMouseDown={onMouseDown ?? ((e) => e.preventDefault())}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>
  );
}

export function HarvyContextMenuDivider() {
  return <div className={HARVY_CONTEXT_MENU_DIVIDER_CLASS} aria-hidden />;
}

type UseHarvyContextMenuPortalOptions = {
  editor: Editor | null;
  anchor: HarvyContextMenuAnchorRange | null;
  placement?: HarvyContextMenuPlacement;
  visible: boolean;
  onClose: () => void;
  repositionDeps?: unknown[];
};

/** Mount a React context menu in the editor scroll column with shared anchoring. */
export function useHarvyContextMenuPortal({
  editor,
  anchor,
  placement = "beside-below-end",
  visible,
  onClose,
  repositionDeps = [],
}: UseHarvyContextMenuPortalOptions) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);

  const reposition = useCallback(() => {
    const ed = editor;
    const menu = menuRef.current;
    if (!ed || !menu || !anchor || !visible) return;

    const mount = getHarvyContextMenuMount(ed.view);
    if (!mount) return;

    if (!isHarvyContextMenuAnchorVisible(ed.view, anchor)) {
      onClose();
      return;
    }

    placeHarvyContextMenu(menu, ed.view, mount, anchor, placement);
  }, [editor, anchor, placement, visible, onClose]);

  useEffect(() => {
    if (!editor || !visible) {
      setMountEl(null);
      return;
    }
    const mount = getHarvyContextMenuMount(editor.view);
    if (mount) {
      ensureHarvyContextMenuMount(mount);
      setMountEl(mount);
    }
  }, [editor, visible]);

  useLayoutEffect(() => {
    if (!visible || !anchor) return;
    reposition();
  }, [visible, anchor, reposition, ...repositionDeps]);

  useEffect(() => {
    if (!editor || !visible || !anchor) return;

    const onScroll = () => reposition();
    const onResize = () => reposition();
    const scrollEls = findScrollableAncestors(editor.view.dom);

    for (const scrollEl of scrollEls) {
      scrollEl.addEventListener("scroll", onScroll, { passive: true });
    }
    window.addEventListener("resize", onResize);

    return () => {
      for (const scrollEl of scrollEls) {
        scrollEl.removeEventListener("scroll", onScroll);
      }
      window.removeEventListener("resize", onResize);
    };
  }, [editor, visible, anchor, reposition]);

  useEffect(() => {
    if (!visible) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      if (editor?.view.dom.contains(target as Node)) return;
      onClose();
    };
    const onInput = () => onClose();

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    editor?.view.dom.addEventListener("input", onInput);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      editor?.view.dom.removeEventListener("input", onInput);
    };
  }, [visible, editor, onClose]);

  useEffect(() => {
    if (visible) closeHarvyContextMenu();
  }, [visible]);

  return { menuRef, mountEl: visible && anchor ? mountEl : null, reposition };
}

export function HarvyContextMenuPortal({
  mountEl,
  children,
}: {
  mountEl: HTMLElement | null;
  children: ReactNode;
}) {
  if (!mountEl) return null;
  return createPortal(children, mountEl);
}
