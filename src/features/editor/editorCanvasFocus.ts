import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

function isFocusableWritingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Node)) return false;
  const el = target instanceof HTMLElement ? target : target.parentElement;
  if (!el) return false;
  if (el.closest(".harvy-image-node__toolbar")) return false;
  if (el.closest(".harvy-image-node__insertion-zone")) return false;
  if (el.closest("[data-harvy-grammar]")) return false;
  return true;
}

/** Place the caret from viewport coordinates (end/start fallback when unmapped). */
export function focusEditorAtClientCoords(
  view: EditorView,
  clientX: number,
  clientY: number,
): void {
  const hit = view.posAtCoords({ left: clientX, top: clientY });

  if (hit?.pos != null) {
    const $pos = view.state.doc.resolve(hit.pos);
    view.dispatch(view.state.tr.setSelection(TextSelection.near($pos)));
    view.focus();
    return;
  }

  const { doc } = view.state;
  const selection =
    doc.textContent.length === 0 ? TextSelection.atStart(doc) : TextSelection.atEnd(doc);
  view.dispatch(view.state.tr.setSelection(selection));
  view.focus();
}

/**
 * Focus the editor from a pointer event when ProseMirror would otherwise ignore the click
 * (padding below content, empty canvas, whitespace beside the writing column).
 * Returns true when the event was handled.
 */
export function handleEditorCanvasFocusPointerDown(
  view: EditorView,
  event: MouseEvent,
  control?: EditorCanvasFocusControl,
): boolean {
  if (event.button !== 0) return false;
  if (!isFocusableWritingTarget(event.target)) return false;

  const insideEditorDom = view.dom.contains(event.target as Node);
  const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });

  if (insideEditorDom && hit) {
    activateEditorFocusControl(control);
    return false;
  }

  activateEditorFocusControl(control);
  focusEditorAtClientCoords(view, event.clientX, event.clientY);
  return true;
}

export function handleEditorWritingSurfacePointerDown(
  event: MouseEvent,
  control?: EditorCanvasFocusControl,
): void {
  if (event.button !== 0) return;
  if (!isFocusableWritingTarget(event.target)) return;
  activateEditorFocusControl(control);
}

/** Remove editor focus without changing document content or selection. */
export function blurEditorIfActive(editor: Editor | null): void {
  if (!editor) return;

  const { dom } = editor.view;
  if (!editor.isFocused && !dom.contains(document.activeElement)) return;

  editor.commands.blur();
}

/** Blur and clear native DOM selection highlight (ProseMirror selection is unchanged). */
export function visuallyDeactivateEditor(editor: Editor | null): void {
  blurEditorIfActive(editor);
  const domSelection = window.getSelection();
  if (domSelection && domSelection.rangeCount > 0) {
    domSelection.removeAllRanges();
  }
}

export type EditorCanvasFocusControl = {
  isFocusSuppressed: () => boolean;
  onUserActivate: () => void;
};

/** User intentionally clicked the writing surface — allow focus from this point on. */
export function activateEditorFocusControl(control: EditorCanvasFocusControl | undefined): void {
  if (!control?.isFocusSuppressed()) return;
  control.onUserActivate();
}

/** Block focus while suppressed (e.g. after returning from Collect/Format). */
export function rejectEditorFocusIfSuppressed(
  view: EditorView,
  control: EditorCanvasFocusControl | undefined,
): boolean {
  if (!control?.isFocusSuppressed()) return false;
  view.dom.blur();
  return true;
}
