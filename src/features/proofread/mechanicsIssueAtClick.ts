import type { EditorView } from "@tiptap/pm/view";
import { mechanicsUnderlineLayerKey } from "./mechanicsUnderlineLayer";
import { proofreadPlainTextAndPositions } from "./proofreadPlainMap";
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

type SuggestionPmHit = {
  from: number;
  to: number;
  text: string;
  issue: ProofreadIssue;
};

function findIssueForPmRange(
  from: number,
  to: number,
  issues: readonly ProofreadIssue[],
  charToPmPos: number[],
): ProofreadIssue | null {
  let best: ProofreadIssue | null = null;
  let bestLen = Infinity;

  for (const issue of issues) {
    if (issue.type !== "suggestion") continue;
    const pm = pmRangeForPlainRange(charToPmPos, issue.start, issue.end);
    if (!pm) continue;
    if (pm.from <= from && pm.to >= to) {
      const len = pm.to - pm.from;
      if (len < bestLen) {
        best = issue;
        bestLen = len;
      }
    }
  }

  return best;
}

function issueFromOverlayRange(
  view: EditorView,
  from: number,
  to: number,
  issues: readonly ProofreadIssue[],
): ProofreadIssue {
  const text = view.state.doc.textBetween(from, to, "");
  const { charToPmPos } = proofreadPlainTextAndPositions(view.state.doc);
  const matched = findIssueForPmRange(from, to, issues, charToPmPos);
  if (matched) return matched;

  return {
    type: "suggestion",
    text,
    message: "Style suggestion",
    start: 0,
    end: text.length,
  };
}

/** Smallest suggestion underline range containing `pmPos`. */
function findSuggestionRangeContainingPm(
  view: EditorView,
  pmPos: number,
  issues: readonly ProofreadIssue[],
): SuggestionPmHit | null {
  const layerState = mechanicsUnderlineLayerKey.getState(view.state);
  let best: { from: number; to: number } | null = null;

  for (const range of layerState?.ranges ?? []) {
    if (range.type !== "suggestion") continue;
    if (range.from >= range.to) continue;
    if (range.from <= pmPos && range.to >= pmPos) {
      const len = range.to - range.from;
      if (!best || len < best.to - best.from) {
        best = { from: range.from, to: range.to };
      }
    }
  }

  const { charToPmPos } = proofreadPlainTextAndPositions(view.state.doc);
  for (const issue of issues) {
    if (issue.type !== "suggestion") continue;
    const pm = pmRangeForPlainRange(charToPmPos, issue.start, issue.end);
    if (!pm) continue;
    if (pm.from <= pmPos && pm.to >= pmPos) {
      const len = pm.to - pm.from;
      if (!best || len < best.to - best.from) {
        best = { from: pm.from, to: pm.to };
      }
    }
  }

  if (!best) return null;

  const text = view.state.doc.textBetween(best.from, best.to, "");
  if (!text) return null;

  const issue = issueFromOverlayRange(view, best.from, best.to, issues);

  return { from: best.from, to: best.to, text, issue };
}

export type MechanicsSuggestionPopoverAnchor = {
  text: string;
  issue: ProofreadIssue;
  rect: DOMRect;
  pmFrom: number;
  pmTo: number;
};

export function getMechanicsSuggestionAtPointer(
  view: EditorView,
  clientX: number,
  clientY: number,
  issues: readonly ProofreadIssue[] = [],
): MechanicsSuggestionPopoverAnchor | null {
  const hit = view.posAtCoords({ left: clientX, top: clientY });
  if (!hit) return null;

  const suggestion = findSuggestionRangeContainingPm(view, hit.pos, issues);
  if (!suggestion) return null;

  const c1 = view.coordsAtPos(suggestion.from);
  const c2 = view.coordsAtPos(suggestion.to);
  const left = Math.min(c1.left, c2.left);
  const top = Math.min(c1.top, c2.top);
  const right = Math.max(c1.right, c2.right);
  const bottom = Math.max(c1.bottom, c2.bottom);
  const w = right - left;
  const h = bottom - top;
  if (w < 1 && h < 1) return null;

  return {
    text: suggestion.text,
    issue: suggestion.issue,
    rect: new DOMRect(left, top, w, h),
    pmFrom: suggestion.from,
    pmTo: suggestion.to,
  };
}
