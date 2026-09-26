import type { Editor } from "@tiptap/core";

export type DocumentFindRange = {
  from: number;
  to: number;
};

/** Match that contains the caret, or the next match after it. Wraps to the first. */
export function activeFindIndex(ranges: DocumentFindRange[], pos: number): number {
  if (ranges.length === 0) return 0;
  const idx = ranges.findIndex((range) => range.to > pos);
  return idx === -1 ? 0 : idx;
}

export function wrapFindIndex(index: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return (index + delta + count) % count;
}

/** Workspace search supplies the word; otherwise use the current selection. */
export function resolveDocumentFindSeed(initialQuery: string | undefined, editor: Editor): string {
  const seeded = initialQuery?.trim() ?? "";
  if (seeded) return seeded;
  return findSeedFromEditor(editor);
}

/** Selected word to prefill Find. Skips multi-line and very long selections. */
export function findSeedFromEditor(editor: Editor): string {
  const { from, to, empty } = editor.state.selection;
  if (!empty) {
    const text = editor.state.doc.textBetween(from, to, "\n", " ");
    if (text && !text.includes("\n") && text.length <= 200) return text;
  }

  const active = document.activeElement;
  if (
    active instanceof HTMLTextAreaElement &&
    (active.id === "harvy-post-title" || active.id === "harvy-post-subtitle")
  ) {
    const text = active.value.slice(active.selectionStart, active.selectionEnd);
    if (text && !text.includes("\n") && text.length <= 200) return text;
  }

  return "";
}
