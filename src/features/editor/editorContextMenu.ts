import type { EditorView } from "@tiptap/pm/view";
import { focusEditorAtClientCoords } from "./editorCanvasFocus";
import {
  getSpellingIssueAtClick,
  getSpellingIssueAtPointer,
} from "../proofread/spellingIssueAtClick";
import { spellingContextMenuRef } from "../proofread/spellingContextMenuRef";
import { openSpellingSuggestionPopover } from "../proofread/spellingSuggestionPopover";
import { getMechanicsSuggestionAtPointer } from "../proofread/mechanicsIssueAtClick";
import { openMechanicsSuggestionPopover } from "../proofread/mechanicsSuggestionPopover";
import {
  closeHarvyContextMenu,
  openHarvyContextMenu,
  type HarvyContextMenuAnchorRange,
  type HarvyContextMenuSection,
} from "./harvyContextMenu";

export function removeEditorContextMenu(): void {
  closeHarvyContextMenu();
}

function focusViewAtCoords(view: EditorView, clientX: number, clientY: number): void {
  focusEditorAtClientCoords(view, clientX, clientY);
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
  event: MouseEvent;
  view: EditorView;
  canInsertImage: boolean;
  onInsertImage: () => void | Promise<void>;
}): void {
  const { event, view, canInsertImage, onInsertImage } = opts;
  const { from, to, empty } = view.state.selection;
  const hasSelection = !empty && from !== to;

  const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
  const anchor: HarvyContextMenuAnchorRange = hasSelection
    ? { from, to }
    : hit
      ? { from: hit.pos, to: hit.pos }
      : { from, to: from };

  const sections: HarvyContextMenuSection[] = [
    [
      {
        label: "Cut",
        onClick: () => runClipboardCommand(view, "cut"),
        disabled: !hasSelection,
      },
      {
        label: "Copy",
        onClick: () => runClipboardCommand(view, "copy"),
        disabled: !hasSelection,
      },
      { label: "Paste", onClick: () => runClipboardCommand(view, "paste") },
    ],
  ];

  if (canInsertImage) {
    sections.push([{ label: "Insert image", onClick: () => void onInsertImage() }]);
  }

  openHarvyContextMenu({
    view,
    anchor,
    sections,
    placement: "below-start",
  });
}

function openSpellingPopoverAtEvent(
  view: EditorView,
  event: MouseEvent,
  preferSelection: boolean,
): boolean {
  if (!spellingContextMenuRef.enabled) return false;
  const anchor = preferSelection
    ? getSpellingIssueAtClick(view, event, spellingContextMenuRef.issues)
    : getSpellingIssueAtPointer(view, event.clientX, event.clientY, spellingContextMenuRef.issues);
  if (!anchor) return false;
  openSpellingSuggestionPopover({ view, anchor });
  return true;
}

/** Open the spelling suggestion popover when the pointer hits a misspelled word. */
export function tryOpenSpellingSuggestionPopover(view: EditorView, event: MouseEvent): boolean {
  if (!shouldOpenEditorContextMenu(event.target, view)) return false;
  return openSpellingPopoverAtEvent(view, event, false);
}

function openMechanicsSuggestionAtEvent(view: EditorView, event: MouseEvent): boolean {
  if (!spellingContextMenuRef.enabled) return false;
  const anchor = getMechanicsSuggestionAtPointer(
    view,
    event.clientX,
    event.clientY,
    spellingContextMenuRef.issues,
  );
  if (!anchor) return false;
  openMechanicsSuggestionPopover({ view, anchor });
  return true;
}

/** Open the mechanics suggestion popover when the pointer hits a green underline. */
export function tryOpenMechanicsSuggestionPopover(view: EditorView, event: MouseEvent): boolean {
  if (!shouldOpenEditorContextMenu(event.target, view)) return false;
  return openMechanicsSuggestionAtEvent(view, event);
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

  if (openSpellingPopoverAtEvent(view, event, opts.placeCaret === false)) {
    return true;
  }

  if (openMechanicsSuggestionAtEvent(view, event)) {
    return true;
  }

  openEditorContextMenu({
    event,
    view,
    canInsertImage: opts.canInsertImage,
    onInsertImage: opts.onInsertImage,
  });
  return true;
}
