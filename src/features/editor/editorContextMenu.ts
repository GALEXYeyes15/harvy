import type { EditorView } from "@tiptap/pm/view";
import { focusEditorAtClientCoords } from "./editorCanvasFocus";
import {
  addWordToCustomDictionary,
  ignoreSpellingWordForDocument,
} from "../proofread/mechanics/spellingDictionary";
import { getSpellingIssueAtClick, type SpellingPopoverAnchor } from "../proofread/spellingIssueAtClick";
import { spellingContextMenuRef } from "../proofread/spellingContextMenuRef";
import {
  closeHarvyContextMenu,
  openHarvyContextMenu,
  type HarvyContextMenuAnchorRange,
  type HarvyContextMenuSection,
} from "./harvyContextMenu";

export function removeEditorContextMenu(): void {
  closeHarvyContextMenu();
}

function resolveMenuAnchor(
  view: EditorView,
  event: MouseEvent,
  spellingAnchor: SpellingPopoverAnchor | null,
): HarvyContextMenuAnchorRange {
  const { from, to, empty } = view.state.selection;
  if (!empty && to > from) {
    return { from, to };
  }
  if (spellingAnchor) {
    return { from: spellingAnchor.pmFrom, to: spellingAnchor.pmTo };
  }

  const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (hit) {
    return { from: hit.pos, to: hit.pos };
  }

  return { from, to: from };
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
  spellingWord?: string | null;
  spellingAnchor?: SpellingPopoverAnchor | null;
}): void {
  const { event, view, canInsertImage, onInsertImage, spellingWord, spellingAnchor } = opts;
  const { from, to, empty } = view.state.selection;
  const hasSelection = !empty && from !== to;

  const anchor = resolveMenuAnchor(view, event, spellingAnchor ?? null);

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

  if (spellingWord) {
    sections.push([
      {
        label: "Ignore",
        onClick: () => {
          ignoreSpellingWordForDocument(spellingWord, spellingContextMenuRef.documentKey);
          spellingContextMenuRef.onRefresh();
        },
      },
      {
        label: "Add to Dictionary",
        onClick: () => {
          addWordToCustomDictionary(spellingWord);
          spellingContextMenuRef.onRefresh();
        },
      },
    ]);
  }

  openHarvyContextMenu({
    view,
    anchor,
    sections,
    placement: "below-start",
  });
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

  let spellingWord: string | null = null;
  let spellingAnchor: SpellingPopoverAnchor | null = null;
  if (spellingContextMenuRef.enabled) {
    spellingAnchor = getSpellingIssueAtClick(view, event, spellingContextMenuRef.issues);
    spellingWord = spellingAnchor?.word ?? null;
  }

  openEditorContextMenu({
    event,
    view,
    canInsertImage: opts.canInsertImage,
    onInsertImage: opts.onInsertImage,
    spellingWord,
    spellingAnchor,
  });
  return true;
}
