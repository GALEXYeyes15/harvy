import type { EditorView } from "@tiptap/pm/view";

export type HarvyContextMenuItem = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export type HarvyContextMenuSection = HarvyContextMenuItem[];

export type HarvyContextMenuAnchorRange = {
  from: number;
  to: number;
};

export type HarvyContextMenuPlacement = "below-start" | "beside-below-end";

export const HARVY_CONTEXT_MENU_CLASS = "harvy-context-menu";
export const HARVY_CONTEXT_MENU_ITEM_CLASS = "harvy-context-menu-item";
export const HARVY_CONTEXT_MENU_ITEM_DISABLED_CLASS = "harvy-context-menu-item--disabled";
export const HARVY_CONTEXT_MENU_DIVIDER_CLASS = "harvy-context-menu-divider";
export const HARVY_CONTEXT_MENU_TOOLBAR_CLASS = "harvy-context-menu-toolbar";
export const HARVY_CONTEXT_MENU_TOOLBAR_BTN_CLASS = "harvy-context-menu-toolbar-btn";
export const HARVY_CONTEXT_MENU_TOOLBAR_BTN_ACTIVE_CLASS = "harvy-context-menu-toolbar-btn--active";

function isScrollableOverflow(value: string): boolean {
  return value === "auto" || value === "scroll" || value === "overlay";
}

export function findScrollableAncestors(el: HTMLElement): HTMLElement[] {
  const ancestors: HTMLElement[] = [];
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY, overflowX } = window.getComputedStyle(node);
    if (isScrollableOverflow(overflowY) || isScrollableOverflow(overflowX)) {
      ancestors.push(node);
    }
    node = node.parentElement;
  }
  return ancestors;
}

/** Content wrapper inside the editor scroll column (scrolls with document text). */
export function getHarvyContextMenuMount(view: EditorView): HTMLElement | null {
  const editorEl = view.dom;
  if (!editorEl?.isConnected) return null;

  const scrollContainer = findScrollableAncestors(editorEl)[0];
  if (!scrollContainer) return editorEl.parentElement;

  let node: HTMLElement | null = editorEl;
  while (node?.parentElement && node.parentElement !== scrollContainer) {
    node = node.parentElement;
  }

  return node ?? editorEl.parentElement;
}

/**
 * Same mount as mechanics underlines (sibling of ProseMirror) so popovers share
 * the underline coordinate space — left edge lines up with the green bar.
 */
export function getHarvyUnderlineAlignedMount(view: EditorView): HTMLElement | null {
  const editorEl = view.dom;
  if (!editorEl?.isConnected) return null;
  return editorEl.parentElement;
}

export function ensureHarvyContextMenuMount(mount: HTMLElement): void {
  if (window.getComputedStyle(mount).position === "static") {
    mount.style.position = "relative";
  }
}

export function isHarvyContextMenuAnchorVisible(
  view: EditorView,
  anchor: HarvyContextMenuAnchorRange,
): boolean {
  try {
    const start = view.coordsAtPos(anchor.from, 1);
    const end = view.coordsAtPos(anchor.to, -1);
    const top = Math.min(start.top, end.top);
    const bottom = Math.max(start.bottom, end.bottom);

    const scrollEls = findScrollableAncestors(view.dom);
    if (scrollEls.length === 0) return true;

    return scrollEls.some((scrollEl) => {
      const rect = scrollEl.getBoundingClientRect();
      return bottom >= rect.top && top <= rect.bottom;
    });
  } catch {
    return false;
  }
}

/** First non-empty client rect for a PM range (left edge of the first underlined line). */
function firstLineViewportRect(
  view: EditorView,
  from: number,
  to: number,
): { left: number; right: number; top: number; bottom: number } | null {
  try {
    const start = view.coordsAtPos(from, 1);
    const end = view.coordsAtPos(to, -1);
    if (Math.abs(start.bottom - end.bottom) < 6) {
      return {
        left: start.left,
        right: end.right,
        top: start.top,
        bottom: Math.max(start.bottom, end.bottom),
      };
    }
  } catch {
    /* fall through */
  }

  try {
    const start = view.domAtPos(from);
    const end = view.domAtPos(to);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const rect = Array.from(range.getClientRects()).find((r) => r.width > 0 && r.height > 0);
    if (!rect) return null;
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
  } catch {
    return null;
  }
}

/**
 * Map a viewport X/Y into `mount`-local coordinates for `position: absolute`.
 * Origin is the padding edge (CSS absolute containing block), including scroll.
 */
function viewportToMountLocal(
  mount: HTMLElement,
  viewportX: number,
  viewportY: number,
): { left: number; top: number } {
  const mountRect = mount.getBoundingClientRect();
  const cs = window.getComputedStyle(mount);
  const borderLeft = Number.parseFloat(cs.borderLeftWidth) || 0;
  const borderTop = Number.parseFloat(cs.borderTopWidth) || 0;
  return {
    left: viewportX - mountRect.left - borderLeft + mount.scrollLeft,
    top: viewportY - mountRect.top - borderTop + mount.scrollTop,
  };
}

/** Left edge of the visible Edit tools sidebar, if it overlaps the editor. */
function toolsSidebarLeftViewport(): number | null {
  const panel = document.getElementById("harvy-tools-panel");
  if (!panel) return null;
  const rect = panel.getBoundingClientRect();
  if (rect.width < 16 || rect.height < 16) return null;
  if (panel.closest('[aria-hidden="true"]')) return null;
  return rect.left;
}

/** Rightmost viewport X the popup may occupy without covering the tools rail. */
function popupMaxRightViewport(): number {
  const sidebarLeft = toolsSidebarLeftViewport();
  if (sidebarLeft != null) return sidebarLeft - 8;
  return window.innerWidth - 8;
}

/** Position a menu inside the editor mount from the current document range. */
export function placeHarvyContextMenu(
  menuEl: HTMLElement,
  view: EditorView,
  mount: HTMLElement,
  anchor: HarvyContextMenuAnchorRange,
  placement: HarvyContextMenuPlacement = "below-start",
): void {
  const start = view.coordsAtPos(anchor.from, 1);
  const end = view.coordsAtPos(anchor.to, -1);
  const line = firstLineViewportRect(view, anchor.from, anchor.to);
  const selTop = line?.top ?? Math.min(start.top, end.top);
  const selBottom = line?.bottom ?? Math.max(start.bottom, end.bottom);
  const selLeft = line?.left ?? start.left;
  const selRight = line?.right ?? end.right;

  const gap = 8;
  const menuWidth = menuEl.offsetWidth;
  const menuHeight = menuEl.offsetHeight;

  let left: number;
  let top: number;

  if (placement === "beside-below-end") {
    const beside = viewportToMountLocal(mount, selRight + gap, selBottom + gap);
    left = beside.left;
    top = beside.top;
    if (menuWidth > 0 && left + menuWidth > mount.clientWidth) {
      const flipped = viewportToMountLocal(mount, selRight - menuWidth, selBottom + gap);
      left = flipped.left;
    }
    if (menuHeight > 0 && top + menuHeight > mount.scrollHeight) {
      const above = viewportToMountLocal(mount, selRight + gap, selTop - gap - menuHeight);
      top = above.top;
    }
  } else {
    // below-start: left edge flush with underline start by default.
    // If the popup would overlap the right tools sidebar (or viewport edge),
    // right-align so the popup's right edge matches the underline's right edge.
    const under = viewportToMountLocal(mount, selLeft, selBottom + 4);
    left = under.left;
    top = under.top;

    if (menuWidth > 0) {
      const maxRight = popupMaxRightViewport();
      if (selLeft + menuWidth > maxRight) {
        const rightAligned = viewportToMountLocal(mount, selRight, selBottom + 4);
        left = rightAligned.left - menuWidth;
      }
    }
  }

  menuEl.style.left = `${Math.max(0, left)}px`;
  menuEl.style.top = `${Math.max(0, top)}px`;
}

/** Position a menu below an HTMLElement (title/subtitle fields, etc.). */
export function placeHarvyContextMenuForElement(
  menuEl: HTMLElement,
  mount: HTMLElement,
  element: HTMLElement,
): void {
  const rect = element.getBoundingClientRect();
  const menuWidth = menuEl.offsetWidth;
  const under = viewportToMountLocal(mount, rect.left, rect.bottom + 4);
  let left = under.left;
  const top = under.top;

  if (menuWidth > 0) {
    const maxRight = popupMaxRightViewport();
    if (rect.left + menuWidth > maxRight) {
      const rightAligned = viewportToMountLocal(mount, rect.right, rect.bottom + 4);
      left = rightAligned.left - menuWidth;
    }
  }

  menuEl.style.left = `${Math.max(0, left)}px`;
  menuEl.style.top = `${Math.max(0, top)}px`;
}

export function createHarvyContextMenuElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = HARVY_CONTEXT_MENU_CLASS;
  el.setAttribute("role", "menu");
  return el;
}

export function appendHarvyContextMenuSections(
  menuEl: HTMLElement,
  sections: HarvyContextMenuSection[],
  runAction: (onClick: () => void) => void,
): void {
  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      const divider = document.createElement("div");
      divider.className = HARVY_CONTEXT_MENU_DIVIDER_CLASS;
      divider.setAttribute("aria-hidden", "true");
      menuEl.appendChild(divider);
    }

    for (const item of section) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = item.disabled
        ? HARVY_CONTEXT_MENU_ITEM_DISABLED_CLASS
        : HARVY_CONTEXT_MENU_ITEM_CLASS;
      btn.textContent = item.label;
      btn.disabled = Boolean(item.disabled);
      btn.setAttribute("role", "menuitem");

      if (!item.disabled) {
        btn.addEventListener("pointerdown", (e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          runAction(item.onClick);
        });
      }

      menuEl.appendChild(btn);
    }
  });
}

export type HarvyContextMenuSession = {
  menuEl: HTMLDivElement;
  mount: HTMLElement;
  view: EditorView;
  anchor: HarvyContextMenuAnchorRange;
  placement: HarvyContextMenuPlacement;
  cleanups: Array<() => void>;
};

let activeSession: HarvyContextMenuSession | null = null;

function clearSessionCleanups(session: HarvyContextMenuSession): void {
  for (const cleanup of session.cleanups) cleanup();
  session.cleanups.length = 0;
}

export function closeHarvyContextMenu(): void {
  if (!activeSession) return;
  clearSessionCleanups(activeSession);
  activeSession.menuEl.remove();
  activeSession = null;
}

export function getActiveHarvyContextMenu(): HarvyContextMenuSession | null {
  return activeSession;
}

export function attachHarvyContextMenuListeners(
  session: HarvyContextMenuSession,
  onClose: () => void,
): void {
  const reposition = () => {
    if (!isHarvyContextMenuAnchorVisible(session.view, session.anchor)) {
      onClose();
      return;
    }
    placeHarvyContextMenu(
      session.menuEl,
      session.view,
      session.mount,
      session.anchor,
      session.placement,
    );
  };

  const onScroll = () => reposition();
  const onResize = () => reposition();
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  };
  const onPointerDown = (e: PointerEvent) => {
    const target = e.target;
    if (target instanceof Node && session.menuEl.contains(target)) return;
    onClose();
  };
  const onInput = () => onClose();

  for (const scrollEl of findScrollableAncestors(session.view.dom)) {
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    session.cleanups.push(() => scrollEl.removeEventListener("scroll", onScroll));
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("pointerdown", onPointerDown, true);
  session.view.dom.addEventListener("input", onInput);

  session.cleanups.push(() => window.removeEventListener("resize", onResize));
  session.cleanups.push(() => window.removeEventListener("keydown", onKeyDown));
  session.cleanups.push(() => document.removeEventListener("pointerdown", onPointerDown, true));
  session.cleanups.push(() => session.view.dom.removeEventListener("input", onInput));
}

export function openHarvyContextMenu(opts: {
  view: EditorView;
  anchor: HarvyContextMenuAnchorRange;
  sections: HarvyContextMenuSection[];
  placement?: HarvyContextMenuPlacement;
  onAction?: () => void;
  className?: string;
  /** Prefer the ProseMirror parent (same as underlines) so left edges line up. */
  alignToUnderlineMount?: boolean;
}): void {
  closeHarvyContextMenu();

  const mount = opts.alignToUnderlineMount
    ? getHarvyUnderlineAlignedMount(opts.view) ?? getHarvyContextMenuMount(opts.view)
    : getHarvyContextMenuMount(opts.view);
  if (!mount) return;

  ensureHarvyContextMenuMount(mount);

  const menuEl = createHarvyContextMenuElement();
  if (opts.className) {
    menuEl.classList.add(opts.className);
  }
  const runAction = (onClick: () => void) => {
    closeHarvyContextMenu();
    onClick();
    opts.onAction?.();
    opts.view.focus();
  };

  appendHarvyContextMenuSections(menuEl, opts.sections, runAction);

  const placement = opts.placement ?? "below-start";
  // Attach first so offsetWidth/height and absolute containing block are correct.
  mount.appendChild(menuEl);
  placeHarvyContextMenu(menuEl, opts.view, mount, opts.anchor, placement);

  const session: HarvyContextMenuSession = {
    menuEl,
    mount,
    view: opts.view,
    anchor: opts.anchor,
    placement,
    cleanups: [],
  };

  activeSession = session;
  attachHarvyContextMenuListeners(session, closeHarvyContextMenu);
}

export function openHarvyContextMenuAt(opts: {
  view: EditorView;
  anchor: HarvyContextMenuAnchorRange;
  placement?: HarvyContextMenuPlacement;
  className?: string;
  onAction?: () => void;
  alignToUnderlineMount?: boolean;
  populate: (menuEl: HTMLDivElement, runAction: (onClick: () => void) => void) => void;
}): void {
  closeHarvyContextMenu();

  const mount = opts.alignToUnderlineMount
    ? getHarvyUnderlineAlignedMount(opts.view) ?? getHarvyContextMenuMount(opts.view)
    : getHarvyContextMenuMount(opts.view);
  if (!mount) return;

  ensureHarvyContextMenuMount(mount);

  const menuEl = createHarvyContextMenuElement();
  if (opts.className) {
    menuEl.classList.add(opts.className);
  }

  const runAction = (onClick: () => void) => {
    closeHarvyContextMenu();
    onClick();
    opts.onAction?.();
    opts.view.focus();
  };

  opts.populate(menuEl, runAction);

  const placement = opts.placement ?? "below-start";
  mount.appendChild(menuEl);
  placeHarvyContextMenu(menuEl, opts.view, mount, opts.anchor, placement);

  const session: HarvyContextMenuSession = {
    menuEl,
    mount,
    view: opts.view,
    anchor: opts.anchor,
    placement,
    cleanups: [],
  };

  activeSession = session;
  attachHarvyContextMenuListeners(session, closeHarvyContextMenu);
}
