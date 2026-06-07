import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

let menuEl: HTMLDivElement | null = null;

const MENU_WRAP_CLASS =
  "harvy-editor-menu fixed z-[9999] min-w-[10.5rem] rounded-md border border-line/25 bg-page py-0.5 text-[12px] shadow-md dark:border-white/[0.12] dark:bg-[#252525]";

const MENU_BTN_CLASS =
  "block w-full px-3 py-1.5 text-left text-[12px] text-ink/90 transition hover:bg-ink/[0.06] dark:text-ink/88";

const MENU_BTN_DISABLED_CLASS =
  "block w-full cursor-default px-3 py-1.5 text-left text-[12px] text-muted/45";

const MENU_DIVIDER_CLASS = "my-0.5 h-px bg-line/30 dark:bg-white/[0.08]";

export function removeEditorContextMenu(): void {
  menuEl?.remove();
  menuEl = null;
}

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!menuEl) return;
      if (e.target instanceof Node && menuEl.contains(e.target)) return;
      removeEditorContextMenu();
    },
    true,
  );
}

function placeMenuAtCursor(wrap: HTMLDivElement, clientX: number, clientY: number): void {
  wrap.style.left = `${Math.min(clientX, window.innerWidth - 200)}px`;
  wrap.style.top = `${Math.min(clientY + 4, window.innerHeight - 180)}px`;
}

function focusViewAtCoords(view: EditorView, clientX: number, clientY: number): void {
  const hit = view.posAtCoords({ left: clientX, top: clientY });
  if (hit) {
    const $pos = view.state.doc.resolve(hit.pos);
    view.dispatch(view.state.tr.setSelection(TextSelection.near($pos)));
  }
  view.focus();
}

function runClipboardCommand(view: EditorView, command: "cut" | "copy" | "paste"): void {
  view.focus();
  document.execCommand(command);
}

export function shouldOpenEditorContextMenu(target: EventTarget | null, view: EditorView): boolean {
  if (!(target instanceof Node) || !view.dom.contains(target)) return false;
  const el = target instanceof HTMLElement ? target : (target.parentElement as HTMLElement | null);
  if (!el) return false;
  if (el.closest("[data-harvy-grammar]")) return false;
  if (el.closest(".harvy-image-node__toolbar")) return false;
  return true;
}

export function openEditorContextMenu(opts: {
  clientX: number;
  clientY: number;
  view: EditorView;
  canInsertImage: boolean;
  onInsertImage: () => void | Promise<void>;
}): void {
  removeEditorContextMenu();
  const { clientX, clientY, view, canInsertImage, onInsertImage } = opts;
  const { from, to, empty } = view.state.selection;
  const hasSelection = !empty && from !== to;

  const wrap = document.createElement("div");
  wrap.className = MENU_WRAP_CLASS;
  placeMenuAtCursor(wrap, clientX, clientY);

  const runMenuAction = (onClick: () => void) => {
    removeEditorContextMenu();
    onClick();
    view.focus();
  };

  const mkBtn = (label: string, onClick: () => void, disabled = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = disabled ? MENU_BTN_DISABLED_CLASS : MENU_BTN_CLASS;
    b.textContent = label;
    b.disabled = disabled;
    if (!disabled) {
      // pointerdown + preventDefault: click is often lost when the editor blurs on mousedown.
      b.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        runMenuAction(onClick);
      });
    }
    wrap.appendChild(b);
  };

  const mkDivider = () => {
    const hr = document.createElement("div");
    hr.className = MENU_DIVIDER_CLASS;
    hr.setAttribute("aria-hidden", "true");
    wrap.appendChild(hr);
  };

  if (canInsertImage) {
    mkBtn("Insert image", () => {
      void onInsertImage();
    });
    mkDivider();
  }

  mkBtn(
    "Cut",
    () => {
      runClipboardCommand(view, "cut");
    },
    !hasSelection,
  );
  mkBtn(
    "Copy",
    () => {
      runClipboardCommand(view, "copy");
    },
    !hasSelection,
  );
  mkBtn("Paste", () => {
    runClipboardCommand(view, "paste");
  });

  document.body.appendChild(wrap);
  menuEl = wrap;
}

export function handleEditorContextMenuEvent(
  view: EditorView,
  event: MouseEvent,
  opts: {
    canInsertImage: boolean;
    onInsertImage: () => void | Promise<void>;
    /** Right-click sets the caret before opening; double-click keeps the current selection. */
    placeCaret?: boolean;
  },
): boolean {
  if (!shouldOpenEditorContextMenu(event.target, view)) return false;
  if (opts.placeCaret !== false) {
    event.preventDefault();
    focusViewAtCoords(view, event.clientX, event.clientY);
  }
  openEditorContextMenu({
    clientX: event.clientX,
    clientY: event.clientY,
    view,
    canInsertImage: opts.canInsertImage,
    onInsertImage: opts.onInsertImage,
  });
  return true;
}
