/**
 * User-defined spelling overrides (proper nouns, brands, platform names).
 * Hunspell handles standard English; use this for words Hunspell may reject.
 *
 * Extend via `registerCustomSpellingWords()` for future user ignore lists.
 */

function normalizeSpellingToken(word: string): string {
  return word.toLowerCase().replace(/'/g, "'");
}

/** User / document-specific vocabulary (brands, proper nouns, platform names). */
const customSpellingWords = new Set<string>();

/**
 * Register additional allowed words (e.g. user ignore list, proper nouns, brand names).
 * Matching is case-insensitive on the lowercase/base form.
 */
export function registerCustomSpellingWords(words: readonly string[]): void {
  for (const word of words) {
    const normalized = normalizeSpellingToken(word);
    if (normalized.length > 0) customSpellingWords.add(normalized);
  }
}

/** True when `word` is in the custom allow-list (case-insensitive). */
export function isAllowedSpellingWord(word: string): boolean {
  const lower = normalizeSpellingToken(word);
  if (customSpellingWords.has(lower)) return true;

  const stripped = lower.replace(/'s$/, "");
  if (stripped !== lower && customSpellingWords.has(stripped)) return true;

  return false;
}
