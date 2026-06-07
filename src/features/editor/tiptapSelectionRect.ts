import type { Editor } from "@tiptap/core";

/** Viewport bounding rect for a non-empty ProseMirror selection. */
export function getEditorSelectionViewportRect(editor: Editor): DOMRect | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;
  const c1 = editor.view.coordsAtPos(from);
  const c2 = editor.view.coordsAtPos(to);
  const left = Math.min(c1.left, c2.left);
  const top = Math.min(c1.top, c2.top);
  const right = Math.max(c1.right, c2.right);
  const bottom = Math.max(c1.bottom, c2.bottom);
  const w = right - left;
  const h = bottom - top;
  if (w < 1 && h < 1) return null;
  return new DOMRect(left, top, w, h);
}
