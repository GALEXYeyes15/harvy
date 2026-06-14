/** Curly/prime/grave apostrophes → straight ASCII apostrophe (matches Hunspell ICONV). */
const APOSTROPHE_VARIANTS = /[\u2018\u2019\u2032\u0060\u00B4]/g;

const STRAIGHT_APOSTROPHE = "'";

/** Normalize apostrophe variants so tokenization and Hunspell agree. */
export function normalizeSpellingApostrophes(text: string): string {
  return text.replace(APOSTROPHE_VARIANTS, STRAIGHT_APOSTROPHE);
}

/** Lowercase + straight apostrophe for dictionary keys and lookups. */
export function normalizeSpellingToken(word: string): string {
  return normalizeSpellingApostrophes(word).toLowerCase();
}

/**
 * English word token including contractions and possessives.
 * Examples: won't, John's, I'm, o'clock
 */
export const SPELLING_WORD_RE = /\b[A-Za-z]+(?:'[A-Za-z]+)*\b/g;

export function isSpellingWordToken(word: string): boolean {
  return /^[A-Za-z]+(?:'[A-Za-z]+)*$/.test(normalizeSpellingApostrophes(word));
}

/** Tokenize plain text into words (contractions/possessives = one token). */
export function tokenizeSpellingWords(text: string): string[] {
  const scanText = normalizeSpellingApostrophes(text);
  const re = new RegExp(SPELLING_WORD_RE.source, "g");
  const words: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(scanText)) !== null) {
    words.push(match[0]);
  }
  return words;
}

/** Word count using the same rules as spellcheck tokenization. */
export function countSpellingWords(text: string): number {
  if (!text.trim()) return 0;
  return tokenizeSpellingWords(text).length;
}
