import { isWordSpellingExempt } from "./spellingDictionary";
import { fuzzySpellingSuggestions } from "./spellingFuzzyMatch";
import { getDictionaryWords, getHunspell } from "./hunspellDictionary";
import {
  normalizeSpellingApostrophes,
  normalizeSpellingToken,
  SPELLING_WORD_RE,
} from "./spellingNormalize";
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

/** Lowercase dictionary key used for lookups (apostrophe-normalized). */
export function lookupSpellingWord(token: string): string {
  return normalizeSpellingToken(token);
}

/** All-uppercase letter tokens (e.g. TEH, NASA) — still spell-checked. */
export function isSpellingAcronymToken(word: string): boolean {
  const normalized = normalizeSpellingApostrophes(word);
  return normalized.length > 1 && /^[A-Z']+$/.test(normalized) && /[A-Z]/.test(normalized);
}

/**
 * Title Case or internal caps (Phillips, Skool, McDonald).
 * Excludes all-caps acronyms so obvious uppercase typos stay flagged.
 */
export function isLikelyProperNounOrBrand(word: string): boolean {
  const normalized = normalizeSpellingApostrophes(word);
  if (normalized.length <= 2) return false;
  if (isSpellingAcronymToken(normalized)) return false;
  if (!/^[A-Z]/.test(normalized)) return false;
  return /[a-z]/.test(normalized);
}

/** True when Hunspell accepts the original token or its lowercase lookup form. */
export function isSpellingCorrectInDictionary(word: string): boolean {
  const checker = getHunspell();
  if (!checker) return true;

  const original = normalizeSpellingApostrophes(word);
  const lookupWord = lookupSpellingWord(word);
  return checker.correct(original) || checker.correct(lookupWord);
}

/**
 * Shared validity check for editor underlines and sidebar spelling counts.
 * Original token casing is preserved in the document; only lookup uses lowercase.
 */
export function isSpellingTokenValid(word: string): boolean {
  if (isWordSpellingExempt(word)) return true;
  if (isSpellingCorrectInDictionary(word)) return true;
  if (isLikelyProperNounOrBrand(word)) return true;
  return false;
}

/** Suggested replacements for a misspelled token (typo map, Hunspell, then fuzzy fallback). */
export function getSpellingSuggestions(word: string, limit = 3): string[] {
  if (limit <= 0) return [];

  const lookupWord = lookupSpellingWord(word);
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (replacement: string) => {
    const cased = applyReplacementCase(word, replacement);
    const key = lookupSpellingWord(cased);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(cased);
  };

  const typoFix = COMMON_TYPOS[lookupWord];
  if (typoFix) push(typoFix);

  const checker = getHunspell();
  if (checker) {
    for (const suggestion of checker.suggest(lookupWord)) {
      if (!suggestion?.trim()) continue;
      push(suggestion);
      if (out.length >= limit) break;
    }
  }

  if (out.length < limit) {
    const fuzzy = fuzzySpellingSuggestions(
      lookupWord,
      getDictionaryWords(),
      limit - out.length,
      seen,
    );
    for (const suggestion of fuzzy) {
      push(suggestion);
      if (out.length >= limit) break;
    }
  }

  return out.slice(0, limit);
}

/** Preserve original casing when applying a dictionary suggestion. */
export function applySpellingReplacementCase(original: string, replacement: string): string {
  return applyReplacementCase(original, replacement);
}

/** Scan plain document text for misspellings (typo map + Hunspell). */
export function scanSpellingIssues(text: string): MechanicsRuleHit[] {
  if (!text.trim()) return [];

  const hits: MechanicsRuleHit[] = [];
  const scanText = normalizeSpellingApostrophes(text);
  const wordRe = new RegExp(SPELLING_WORD_RE.source, "g");
  let match: RegExpExecArray | null;

  while ((match = wordRe.exec(scanText)) !== null) {
    const word = match[0];
    const lookupWord = lookupSpellingWord(word);
    if (lookupWord.length <= 2) continue;

    if (isSpellingTokenValid(word)) continue;

    const typoFix = COMMON_TYPOS[lookupWord];
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

    // Hunspell suggest costs 20–75ms per word and this scan reruns on every typing pause;
    // the spelling popover asks for suggestions on click instead.
    hits.push({
      category: "spelling",
      message: `Possible misspelling: “${word}”`,
      start: match.index,
      end: match.index + word.length,
      severity: "high",
    });
  }

  return hits;
}
