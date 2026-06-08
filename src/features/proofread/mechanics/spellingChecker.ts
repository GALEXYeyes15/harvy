import { isCommonWord } from "./commonWordList";
import type { MechanicsRuleHit } from "./types";

/**
 * Placeholder spelling checker — swap this module for nspell, Hunspell, or LanguageTool later.
 * Flags known typos and unknown words (not in `commonWordList`).
 */
const COMMON_TYPOS: Readonly<Record<string, string>> = {
  het: "the",
  teh: "the",
  rexieve: "receive",
  recieve: "receive",
  seperate: "separate",
  definately: "definitely",
  occured: "occurred",
  wierd: "weird",
};

function applyReplacementCase(original: string, replacement: string): string {
  if (original.length === 0) return replacement;
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0]!.toUpperCase()) {
    return replacement[0]!.toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** Scan plain document text for misspellings (typos + unknown words). */
export function scanSpellingIssues(text: string): MechanicsRuleHit[] {
  if (!text.trim()) return [];

  const hits: MechanicsRuleHit[] = [];
  const wordRe = /\b[A-Za-z']+\b/g;
  let match: RegExpExecArray | null;

  while ((match = wordRe.exec(text)) !== null) {
    const word = match[0];
    const lower = word.toLowerCase();
    if (lower.length <= 2) continue;

    const typoFix = COMMON_TYPOS[lower];
    if (typoFix) {
      hits.push({
        category: "spelling",
        message: `Possible misspelling: “${word}”`,
        replacement: applyReplacementCase(word, typoFix),
        start: match.index,
        end: match.index + word.length,
        severity: "high",
      });
      continue;
    }

    if (!isCommonWord(word)) {
      hits.push({
        category: "spelling",
        message: `Unknown word: “${word}”`,
        start: match.index,
        end: match.index + word.length,
        severity: "high",
      });
    }
  }

  return hits;
}
