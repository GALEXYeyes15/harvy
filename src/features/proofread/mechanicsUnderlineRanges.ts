import type { ProofreadIssue } from "./types";

/** PM document range for an independent mechanics underline overlay segment. */
export type MechanicsUnderlineRange = {
  from: number;
  to: number;
  type: ProofreadIssue["type"];
  suggestion?: string;
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
 * Map proofread issues to ProseMirror ranges for the overlay underline layer.
 * Does not create inline decoration spans (avoids nesting inside prose highlights).
 */
export function proofreadIssuesToPmRanges(
  issues: ProofreadIssue[],
  charToPmPos: number[],
  plain: string,
): MechanicsUnderlineRange[] {
  const sorted = [...issues].sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const ranges: MechanicsUnderlineRange[] = [];
  let lastPlainExclusiveEnd = -1;

  for (const issue of sorted) {
    const { start, end } = issue;
    if (start < 0 || end > plain.length || start >= end) continue;
    if (start < lastPlainExclusiveEnd) continue;

    const slice = plain.slice(start, end);
    if (issue.text && issue.text !== slice) continue;

    const pm = pmRangeForPlainRange(charToPmPos, start, end);
    if (!pm || pm.from >= pm.to) continue;

    const suggestion = issue.suggestion?.trim();
    ranges.push({
      from: pm.from,
      to: pm.to,
      type: issue.type,
      ...(suggestion ? { suggestion } : {}),
    });

    lastPlainExclusiveEnd = end;
  }

  return ranges;
}
