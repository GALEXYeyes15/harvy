import type { Node as PMNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { ProofreadIssue } from "./types";

const CLASS: Record<ProofreadIssue["type"], string> = {
  spelling: "spelling-underline",
  grammar: "grammar-underline",
  suggestion: "suggestion-underline",
};

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

/**
 * Converts model issues to inline decorations. Overlaps: after sorting by start asc then
 * length desc, any issue that intersects a previously kept range is skipped (first/longest wins).
 */
export function proofreadIssuesToDecorationSet(
  doc: PMNode,
  issues: ProofreadIssue[],
  charToPmPos: number[],
  plain: string,
): DecorationSet {
  const sorted = [...issues].sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const decos: Decoration[] = [];
  let lastPlainExclusiveEnd = -1;

  for (const issue of sorted) {
    const { start, end } = issue;
    if (start < 0 || end > plain.length || start >= end) continue;
    if (start < lastPlainExclusiveEnd) continue;

    const slice = plain.slice(start, end);
    if (issue.text && issue.text !== slice) {
      continue;
    }

    const pm = pmRangeForPlainRange(charToPmPos, start, end);
    if (!pm || pm.from >= pm.to) continue;

    const cls = CLASS[issue.type];
    if (!cls) continue;

    const suggestion = issue.suggestion?.trim() ?? "";

    decos.push(
      Decoration.inline(pm.from, pm.to, {
        class: cls,
        "data-harvy-proofread-type": issue.type,
        ...(suggestion ? { "data-harvy-proofread-suggestion": suggestion } : {}),
      }),
    );

    lastPlainExclusiveEnd = end;
  }

  return DecorationSet.create(doc, decos);
}
