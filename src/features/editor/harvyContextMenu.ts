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

/** Position a menu inside the editor mount from the current document range. */
export function placeHarvyContextMenu(
  menuEl: HTMLElement,
  view: EditorView,
  mount: HTMLElement,
  anchor: HarvyContextMenuAnchorRange,
  placement: HarvyContextMenuPlacement = "below-start",
): void {
  const mountRect = mount.getBoundingClientRect();
  const start = view.coordsAtPos(anchor.from, 1);
  const end = view.coordsAtPos(anchor.to, -1);

  const selTop = Math.min(start.top, end.top) - mountRect.top;
  const selBottom = Math.max(start.bottom, end.bottom) - mountRect.top;
  const selLeft = start.left - mountRect.left;
  const selRight = end.right - mountRect.left;

  const gap = 8;
  const menuWidth = menuEl.offsetWidth;
  const menuHeight = menuEl.offsetHeight;

  let left: number;
  let top: number;

  if (placement === "beside-below-end") {
    left = selRight + gap;
    if (menuWidth > 0 && left + menuWidth > mount.clientWidth) {
      left = selRight - menuWidth;
    }
    top = selBottom + gap;
    if (menuHeight > 0 && top + menuHeight > mount.clientHeight) {
      top = selTop - gap - menuHeight;
    }
  } else {
    left = selLeft;
    top = selBottom + 4;
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
}): void {
  closeHarvyContextMenu();

  const mount = getHarvyContextMenuMount(opts.view);
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
  placeHarvyContextMenu(menuEl, opts.view, mount, opts.anchor, placement);

  mount.appendChild(menuEl);

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

export function openHarvyContextMenuPanel(opts: {
  view: EditorView;
  anchor: HarvyContextMenuAnchorRange;
  placement?: HarvyContextMenuPlacement;
  className?: string;
  onAction?: () => void;
  populate: (menuEl: HTMLDivElement, runAction: (onClick: () => void) => void) => void;
}): void {
  closeHarvyContextMenu();

  const mount = getHarvyContextMenuMount(opts.view);
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
  placeHarvyContextMenu(menuEl, opts.view, mount, opts.anchor, placement);

  mount.appendChild(menuEl);

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
