import { isWordSpellingExempt } from "./spellingDictionary";
import { getHunspell } from "./hunspellDictionary";
import type { MechanicsRuleHit } from "./types";

/**
 * Hunspell (nspell) spelling mechanics with a typo-map fast path for obvious fixes.
 */

/** High-confidence typo replacements (case-insensitive lookup). Checked before Hunspell. */
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

function casingVariants(word: string): string[] {
  const lower = word.toLowerCase();
  const variants = new Set<string>([word, lower]);
  if (word.length > 1) {
    variants.add(word[0]!.toUpperCase() + word.slice(1).toLowerCase());
    variants.add(word.toUpperCase());
  }
  return [...variants];
}

/** True when Hunspell considers the word correctly spelled (any common casing variant). */
function isCorrectByHunspell(word: string): boolean {
  const checker = getHunspell();
  if (!checker) return true;

  return casingVariants(word).some((variant) => checker.correct(variant));
}

function suggestionForWord(word: string): string | undefined {
  const checker = getHunspell();
  if (!checker) return undefined;
  const suggestions = checker.suggest(word);
  return suggestions[0];
}

/** Scan plain document text for misspellings (typo map + Hunspell). */
export function scanSpellingIssues(text: string): MechanicsRuleHit[] {
  if (!text.trim()) return [];

  const hits: MechanicsRuleHit[] = [];
  const wordRe = /\b[A-Za-z']+\b/g;
  let match: RegExpExecArray | null;

  while ((match = wordRe.exec(text)) !== null) {
    const word = match[0];
    const lower = word.toLowerCase();
    if (lower.length <= 2) continue;
    if (isWordSpellingExempt(word)) continue;

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

    if (isCorrectByHunspell(word)) continue;

    const replacement = suggestionForWord(word);
    hits.push({
      category: "spelling",
      message: `Possible misspelling: “${word}”`,
      ...(replacement ? { replacement: applyReplacementCase(word, replacement) } : {}),
      start: match.index,
      end: match.index + word.length,
      severity: "high",
    });
  }

  return hits;
}
