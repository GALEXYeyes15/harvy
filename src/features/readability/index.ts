import {
  countSpellingWords,
  tokenizeSpellingWords,
} from "../proofread/mechanics/spellingNormalize";

export type SentenceComplexityLevel = "normal" | "complex";

/** Sentence-level FK threshold for complexity classification. */
/** Default cutoff; Settings → Parameters can override via `parametersPrefs`. */
export const FK_SENTENCE_COMPLEXITY_THRESHOLD = 9;

export type SentenceComplexityScore = {
  score: number; // FK-sentence score
  level: SentenceComplexityLevel;
  wordCount: number;
  fkSentence: number;
};

const VOWEL_GROUP_RE = /[aeiouy]+/g;

/**
 * Split on sentence-ending punctuation + following whitespace.
 * Chunks are left as exact substrings of the trimmed source (no per-chunk trim) so
 * `plain.indexOf(chunk)` in decorations still aligns with editor text.
 * Whitespace-only segments are dropped.
 */
export function splitTextIntoSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const chunks = trimmed.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (chunks.length > 0) return chunks;
  return [trimmed];
}

/**
 * Analysis-only copy: collapse all whitespace runs (spaces, tabs, newlines) to a single space,
 * then trim. Does not modify editor content — use only for scoring/counting.
 */
export function normalizeSentenceForAnalysis(sentence: string): string {
  return sentence.replace(/\s+/g, " ").trim();
}

export function countWords(text: string): number {
  return countSpellingWords(text);
}

export function wordsInSentence(sentence: string): number {
  return countWords(normalizeSentenceForAnalysis(sentence));
}

export function estimateSyllablesInWord(rawWord: string): number {
  const word = rawWord.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return 0;
  if (word.length <= 3) return 1;
  const deSuffixed = word.replace(/(?:e|es|ed)$/i, "");
  const core = deSuffixed || word;
  const groups = core.match(VOWEL_GROUP_RE);
  return Math.max(1, groups ? groups.length : 1);
}

export function estimateSyllables(text: string): number {
  const words = tokenizeSpellingWords(text);
  if (words.length === 0) return 0;
  return words.reduce((total, word) => total + estimateSyllablesInWord(word), 0);
}

/**
 * Flesch Reading Ease:
 * 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
 */
export function calculateFleschReadingEase(
  totalWords: number,
  totalSentences: number,
  totalSyllables: number,
): number {
  if (totalWords <= 0 || totalSentences <= 0) return 0;
  return 206.835 - 1.015 * (totalWords / totalSentences) - 84.6 * (totalSyllables / totalWords);
}

/**
 * Flesch-Kincaid Grade Level:
 * 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
 */
export function calculateFleschKincaidGradeLevel(
  totalWords: number,
  totalSentences: number,
  totalSyllables: number,
): number {
  if (totalWords <= 0 || totalSentences <= 0) return 0;
  return 0.39 * (totalWords / totalSentences) + 11.8 * (totalSyllables / totalWords) - 15.59;
}

/**
 * Sentence-level FK-inspired density signal:
 * 0.39 * wordCount + 11.8 * (syllables/wordCount) - 15.59
 */
export function calculateSentenceFleschKincaidDensity(wordCount: number, syllableCount: number): number {
  if (wordCount <= 0) return 0;
  return 0.39 * wordCount + 11.8 * (syllableCount / wordCount) - 15.59;
}

export function scoreSentenceComplexity(
  sentence: string,
  threshold: number = FK_SENTENCE_COMPLEXITY_THRESHOLD,
): SentenceComplexityScore {
  // Collapse tabs, double spaces, etc. so formatting never inflates FK (same tokens as word count).
  const normalized = normalizeSentenceForAnalysis(sentence);
  const wordCount = countWords(normalized);
  if (wordCount === 0) {
    return { score: 0, level: "normal", wordCount: 0, fkSentence: 0 };
  }
  const syllableCount = estimateSyllables(normalized);
  const fkSentence = calculateSentenceFleschKincaidDensity(wordCount, syllableCount);
  const score = fkSentence;
  const cutoff = Number.isFinite(threshold) ? threshold : FK_SENTENCE_COMPLEXITY_THRESHOLD;
  const level: SentenceComplexityLevel = fkSentence >= cutoff ? "complex" : "normal";

  return {
    score,
    level,
    wordCount,
    fkSentence,
  };
}
