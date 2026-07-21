/** Spaces inserted / removed per Tab / Shift+Tab in document Notes. */
export const NOTES_INDENT = "  ";

export type NotesTabIndentInput = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  /** When true, outdent (Shift+Tab). */
  shiftKey: boolean;
};

export type NotesTabIndentResult = {
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

function leadingIndentLength(line: string): number {
  if (line.startsWith("\t")) return 1;
  let n = 0;
  while (n < NOTES_INDENT.length && line[n] === " ") n += 1;
  return n;
}

/**
 * Tab indents the current / selected lines; Shift+Tab outdents.
 * Uses two spaces so nested `- item` / `1. item` notes stay plain-text friendly.
 */
export function applyNotesTabIndent({
  value,
  selectionStart,
  selectionEnd,
  shiftKey,
}: NotesTabIndentInput): NotesTabIndentResult {
  let selStart = Math.min(selectionStart, selectionEnd);
  let selEnd = Math.max(selectionStart, selectionEnd);

  let blockStart = selStart;
  while (blockStart > 0 && value[blockStart - 1] !== "\n") blockStart -= 1;

  let blockEnd = selEnd;
  if (selEnd > selStart && value[selEnd - 1] === "\n") blockEnd = selEnd - 1;
  while (blockEnd < value.length && value[blockEnd] !== "\n") blockEnd += 1;

  const lines = value.slice(blockStart, blockEnd).split("\n");
  const out: string[] = [];
  let lineStart = blockStart;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    let next: string;
    let delta: number;

    if (shiftKey) {
      const remove = leadingIndentLength(line);
      next = line.slice(remove);
      delta = -remove;
    } else {
      next = `${NOTES_INDENT}${line}`;
      delta = NOTES_INDENT.length;
    }
    out.push(next);

    if (delta !== 0) {
      if (selStart > lineStart) {
        selStart += delta;
      } else if (selStart === lineStart && delta > 0) {
        selStart += delta;
      } else if (selStart > lineStart + delta && delta < 0) {
        selStart = lineStart;
      }

      if (selEnd > lineStart) {
        selEnd += delta;
      } else if (selEnd === lineStart && delta > 0) {
        selEnd += delta;
      } else if (selEnd > lineStart + delta && delta < 0) {
        selEnd = lineStart;
      }
    }

    lineStart += line.length + 1;
  }

  const nextValue = `${value.slice(0, blockStart)}${out.join("\n")}${value.slice(blockEnd)}`;
  return {
    value: nextValue,
    selectionStart: Math.max(0, Math.min(selStart, nextValue.length)),
    selectionEnd: Math.max(0, Math.min(selEnd, nextValue.length)),
  };
}

/** Apply Tab / Shift+Tab on a notes textarea; returns true when handled. */
export function handleNotesTextareaTabKey(
  event: { key: string; shiftKey: boolean; preventDefault: () => void },
  textarea: HTMLTextAreaElement,
  onChange: (value: string) => void,
): boolean {
  if (event.key !== "Tab") return false;
  event.preventDefault();

  const result = applyNotesTabIndent({
    value: textarea.value,
    selectionStart: textarea.selectionStart,
    selectionEnd: textarea.selectionEnd,
    shiftKey: event.shiftKey,
  });

  onChange(result.value);
  queueMicrotask(() => {
    textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
  });
  return true;
}
