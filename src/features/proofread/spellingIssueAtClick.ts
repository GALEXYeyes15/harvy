import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { mechanicsUnderlineLayerKey } from "./mechanicsUnderlineLayer";
import { proofreadPlainTextAndPositions } from "./proofreadPlainMap";
import { isSpellingWordToken, normalizeSpellingApostrophes, SPELLING_WORD_RE } from "./mechanics/spellingNormalize";
import type { ProofreadIssue } from "./types";

function pmRangeForPlainRange(
  charToPmPos: number[],
  start: number,
  end: number,
): { from: number; to: number } | null {
  if (start < 0 || end > charToPmPos.length || start >= end) return null;
  const from = charToPmPos[start]!;
  const last = charToPmPos[end - 1]!;
  if (from < 0 || last < 0) return null;
  return { from, to: last + 1 };
}

/** ProseMirror range for the word under `pos` in a text block. */
export function wordRangeAtPmPos(
  doc: PMNode,
  pos: number,
): { from: number; to: number; text: string } | null {
  const $pos = doc.resolve(pos);
  if (!$pos.parent.isTextblock) return null;

  const parentText = normalizeSpellingApostrophes($pos.parent.textContent);
  const parentStart = $pos.start();
  const offset = $pos.parentOffset;

  const wordRe = new RegExp(SPELLING_WORD_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = wordRe.exec(parentText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset < end) {
      return { from: parentStart + start, to: parentStart + end, text: match[0] };
    }
  }
  return null;
}

/** Word range after double-click — browser/PM usually selects the word before `dblclick` fires. */
function getWordRangeForDoubleClick(
  view: EditorView,
  event: MouseEvent,
): { from: number; to: number; text: string } | null {
  const { from, to, empty } = view.state.selection;
  if (!empty && to > from) {
    const selected = view.state.doc.textBetween(from, to, "");
    if (isSpellingWordToken(selected)) {
      return { from, to, text: selected };
    }
  }

  const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!hit) return null;

  return (
    wordRangeAtPmPos(view.state.doc, hit.pos) ??
    (hit.pos > 0 ? wordRangeAtPmPos(view.state.doc, hit.pos - 1) : null)
  );
}

type SpellingPmRange = {
  from: number;
  to: number;
  text: string;
  issue: ProofreadIssue;
};

/** Spelling underline range overlapping a ProseMirror range (plugin ranges first). */
function findSpellingRangeOverlappingPm(
  view: EditorView,
  pmFrom: number,
  pmTo: number,
  issues: readonly ProofreadIssue[],
): SpellingPmRange | null {
  const layerState = mechanicsUnderlineLayerKey.getState(view.state);
  for (const range of layerState?.ranges ?? []) {
    if (range.type !== "spelling") continue;
    if (range.from >= range.to) continue;
    if (range.from < pmTo && range.to > pmFrom) {
      const text = view.state.doc.textBetween(range.from, range.to, "");
      if (!text) continue;
      return {
        from: range.from,
        to: range.to,
        text,
        issue: {
          type: "spelling",
          text,
          suggestion: range.suggestion,
          start: 0,
          end: text.length,
        },
      };
    }
  }

  const { charToPmPos } = proofreadPlainTextAndPositions(view.state.doc);
  for (const issue of issues) {
    if (issue.type !== "spelling") continue;
    const pm = pmRangeForPlainRange(charToPmPos, issue.start, issue.end);
    if (!pm) continue;
    if (pm.from < pmTo && pm.to > pmFrom) {
      const text = issue.text || view.state.doc.textBetween(pm.from, pm.to, "");
      return {
        from: pm.from,
        to: pm.to,
        text,
        issue,
      };
    }
  }

  return null;
}

export type SpellingPopoverAnchor = {
  word: string;
  issue: ProofreadIssue;
  rect: DOMRect;
  pmFrom: number;
  pmTo: number;
};

/** Resolve spelling issue + viewport anchor for a pointer position in the editor. */
export function getSpellingIssueAtPointer(
  view: EditorView,
  clientX: number,
  clientY: number,
  issues: readonly ProofreadIssue[] = [],
): SpellingPopoverAnchor | null {
  const hit = view.posAtCoords({ left: clientX, top: clientY });
  if (!hit) return null;

  const wordRange =
    wordRangeAtPmPos(view.state.doc, hit.pos) ??
    (hit.pos > 0 ? wordRangeAtPmPos(view.state.doc, hit.pos - 1) : null);
  if (!wordRange) return null;

  return spellingAnchorForPmRange(view, wordRange.from, wordRange.to, issues);
}

function spellingAnchorForPmRange(
  view: EditorView,
  pmFrom: number,
  pmTo: number,
  issues: readonly ProofreadIssue[],
): SpellingPopoverAnchor | null {
  const spelling = findSpellingRangeOverlappingPm(view, pmFrom, pmTo, issues);
  if (!spelling) return null;

  const c1 = view.coordsAtPos(spelling.from);
  const c2 = view.coordsAtPos(spelling.to);
  const left = Math.min(c1.left, c2.left);
  const top = Math.min(c1.top, c2.top);
  const right = Math.max(c1.right, c2.right);
  const bottom = Math.max(c1.bottom, c2.bottom);
  const w = right - left;
  const h = bottom - top;
  if (w < 1 && h < 1) return null;

  return {
    word: spelling.text,
    issue: spelling.issue,
    rect: new DOMRect(left, top, w, h),
    pmFrom: spelling.from,
    pmTo: spelling.to,
  };
}

/** Resolve spelling issue + viewport anchor for a double-click in the editor. */
export function getSpellingIssueAtClick(
  view: EditorView,
  event: MouseEvent,
  issues: readonly ProofreadIssue[] = [],
): SpellingPopoverAnchor | null {
  const wordRange = getWordRangeForDoubleClick(view, event);
  if (!wordRange) {
    return getSpellingIssueAtPointer(view, event.clientX, event.clientY, issues);
  }

  return spellingAnchorForPmRange(view, wordRange.from, wordRange.to, issues);
}

/** @deprecated Use `getSpellingIssueAtClick`. */
export function resolveSpellingPopoverAtClick(
  view: EditorView,
  event: MouseEvent,
  issues: readonly ProofreadIssue[],
): SpellingPopoverAnchor | null {
  return getSpellingIssueAtClick(view, event, issues);
}
