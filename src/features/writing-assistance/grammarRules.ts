/**
 * Lightweight, local-only grammar/style hints (not a full linter).
 * Ranges are relative offsets within a single text node.
 */

import { collectAdverbHits } from "./adverbRules";
import { collectPassiveHits } from "./passiveRules";

export type GrammarIssueKind =
  | "double-space"
  | "repeat-word"
  | "trailing-space"
  | "double-punct"
  | "space-before-punct"
  | "passive-voice"
  | "adverb-hint";

const GRAMMAR_KIND_SET = new Set<string>([
  "double-space",
  "repeat-word",
  "trailing-space",
  "double-punct",
  "space-before-punct",
  "passive-voice",
  "adverb-hint",
]);

export function isGrammarIssueKind(s: string): s is GrammarIssueKind {
  return GRAMMAR_KIND_SET.has(s);
}

export interface GrammarIssue {
  start: number;
  end: number;
  kind: GrammarIssueKind;
  /** Short label for menus / a11y */
  label: string;
  /** Optional single-step fix description */
  suggestion?: string;
}

function pushUnique(intervals: GrammarIssue[], next: GrammarIssue): void {
  const overlaps = intervals.some(
    (i) => i.kind === next.kind && !(next.end <= i.start || next.start >= i.end),
  );
  if (!overlaps) intervals.push(next);
}

/**
 * Scan plain text for gentle editorial flags. Skips very short strings.
 */
export function scanTextForGrammarIssues(text: string): GrammarIssue[] {
  if (text.length < 2) return [];
  const out: GrammarIssue[] = [];

  // Double spaces or space+tab clusters (not single newline — those are structural)
  const multiSpace = /(?: {2,}|(?:\t| )(?:\t| ){1,})/g;
  let m: RegExpExecArray | null;
  while ((m = multiSpace.exec(text)) !== null) {
    if (!/\n/.test(m[0])) {
      pushUnique(out, {
        start: m.index,
        end: m.index + m[0].length,
        kind: "double-space",
        label: "Extra space",
        suggestion: "Use a single space",
      });
    }
  }

  // Repeated word (4+ letters) — underline the second occurrence only
  const repeat = /\b([A-Za-z]{4,})\s+\1\b/gi;
  while ((m = repeat.exec(text)) !== null) {
    const word = m[1];
    const afterFirst = m[0].slice(word.length);
    const ws = afterFirst.match(/^\s+/);
    const wsLen = ws ? ws[0].length : 1;
    const secondStart = m.index + word.length + wsLen;
    const secondEnd = secondStart + word.length;
    pushUnique(out, {
      start: secondStart,
      end: secondEnd,
      kind: "repeat-word",
      label: "Repeated word",
      suggestion: "Remove duplicate",
    });
  }

  // Trailing whitespace on a line (soft editorial)
  const trail = /[ \t]{2,}$/gm;
  while ((m = trail.exec(text)) !== null) {
    pushUnique(out, {
      start: m.index,
      end: m.index + m[0].length,
      kind: "trailing-space",
      label: "Trailing space",
      suggestion: "Trim line ending",
    });
  }

  // Double punctuation (not longer ellipses — only exactly doubled marks)
  const doublePunct = /(?:\.{2}(?!\.)|,{2}(?!,)|\?{2}(?!\?)|!{2}(?!!))/g;
  while ((m = doublePunct.exec(text)) !== null) {
    pushUnique(out, {
      start: m.index,
      end: m.index + m[0].length,
      kind: "double-punct",
      label: "Repeated punctuation",
      suggestion: "Use a single mark",
    });
  }

  // Spaces/tabs before punctuation (e.g. "word ,") — not newlines (paragraph breaks)
  const spaceBeforePunct = /[ \t]+([.,;:!?])(?=[ \t\n]|$)/g;
  while ((m = spaceBeforePunct.exec(text)) !== null) {
    const punctStart = m.index + m[0].length - 1;
    pushUnique(out, {
      start: m.index,
      end: punctStart,
      kind: "space-before-punct",
      label: "Space before punctuation",
      suggestion: "Tighten spacing",
    });
  }

  // Passive voice (same detector as sidebar passive count)
  for (const hit of collectPassiveHits(text)) {
    pushUnique(out, {
      start: hit.start,
      end: hit.end,
      kind: "passive-voice",
      label: "Passive voice",
    });
  }

  // Shared adverb detector keeps sidebar counts + editor highlights aligned.
  for (const hit of collectAdverbHits(text)) {
    pushUnique(out, {
      start: hit.start,
      end: hit.end,
      kind: "adverb-hint",
      label: "Adverb / hedging",
    });
  }

  return out.sort((a, b) => a.start - b.start);
}