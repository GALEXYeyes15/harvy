import { collectAdverbHits } from "../writing-assistance/adverbRules";
import { collectPassiveHits } from "../writing-assistance/passiveRules";
import {
  calculateFleschKincaidGradeLevel,
  calculateFleschReadingEase,
  countWords,
  estimateSyllables,
  normalizeSentenceForAnalysis as normalizeSentenceForAnalysisCore,
  splitTextIntoSentences as splitTextIntoSentencesCore,
} from "../readability";

export type EditorStats = {
  readingTime: string;
  letters: number;
  characters: number;
  words: number;
  sentences: number;
  paragraphs: number;
  gradeLabel: string;
  readabilitySummary: string;
  sentenceFeedback: string;
  passiveVoiceFeedback: string;
  /** Display value for “Reading time (300 words/min)” row, e.g. `0:00`, `0:17`, or `2:05` (m:ss). */
  readingTimeAt300Wpm: string;
  /** Matches from the combined adverb + hedging detector (`collectAdverbHits`). */
  adverbs: number;
  /** Matches from the passive detector (`collectPassiveHits`), not “sentences” per se. */
  passiveVoiceSentences: number;
  /** Sentences flagged by the sentence-complexity detector (complex tier). */
  complexSentences: number;
  fleschReadingEase: number;
  fleschKincaidGradeLevel: number;
};

/**
 * Analysis-only: `sentence.replace(/\s+/g, " ").trim()` so indentation, double spaces,
 * and line breaks do not affect counts or complexity. Does not modify editor content.
 */
export function normalizeSentenceForAnalysis(sentence: string): string {
  return normalizeSentenceForAnalysisCore(sentence);
}

export function splitIntoSentences(text: string): string[] {
  return splitTextIntoSentencesCore(text);
}

export function wordsInSentence(sentence: string): number {
  return countWords(normalizeSentenceForAnalysis(sentence));
}

/**
 * Reading duration at 300 wpm: `readingTimeSeconds = round((words / 300) * 60)`, formatted as m:ss
 * (minutes unpadded, seconds zero-padded). Empty document → `0:00`.
 */
function formatReadingTime300Wpm(words: number): string {
  if (words === 0) return "0:00";
  const totalSeconds = Math.round((words / 300) * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function countAdverbs(text: string): number {
  return collectAdverbHits(text).length;
}

const PASSIVE_DEBUG_SENTENCE_RE =
  /framework was designed to simplify decisions, yet it was often misunderstood by those who encountered it/i;

export type SentenceComplexityCounts = Pick<EditorStats, "complexSentences">;

export function calculateEditorStats(text: string, sentenceComplexity: SentenceComplexityCounts): EditorStats {
  const words = countWords(text);
  const isEmpty = words === 0;
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const characters = text.length;
  const sentenceList = splitIntoSentences(text);
  const sentences = sentenceList.length;
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.ceil(words / 200));
  const avgWordsPerSentence = sentences ? words / sentences : words;
  const totalSyllables = estimateSyllables(text);
  const fleschReadingEase = isEmpty ? 0 : calculateFleschReadingEase(words, Math.max(sentences, 1), totalSyllables);
  const fleschKincaidGradeLevel = isEmpty
    ? 0
    : calculateFleschKincaidGradeLevel(words, Math.max(sentences, 1), totalSyllables);
  const passiveSignals = (text.match(/\b(?:was|were|been|being|is|are|be)\s+\w+ed\b/gi) || [])
    .length;

  const passiveHits = collectPassiveHits(text);
  const passiveVoiceSentences = passiveHits.length;
  if (import.meta.env.DEV && PASSIVE_DEBUG_SENTENCE_RE.test(text)) {
    // eslint-disable-next-line no-console
    console.log("[HarvyAnalysisDebug]", {
      passiveHits: passiveHits.map((h) => text.slice(h.start, h.end)),
      passiveCount: passiveHits.length,
    });
  }

  return {
    readingTime: `~${readingMinutes} min`,
    letters,
    characters,
    words,
    sentences,
    paragraphs,
    gradeLabel: `Grade ${Math.max(0, Math.round(fleschKincaidGradeLevel))}`,
    readabilitySummary:
      avgWordsPerSentence > 20
        ? "Long sentences dominate this draft. Consider breaking ideas into shorter units."
        : "Sentence flow is fairly approachable. Keep clauses direct and concrete.",
    sentenceFeedback:
      avgWordsPerSentence > 22
        ? "Several sentences are long. Split one idea per sentence for faster reading."
        : "Sentence length is mostly balanced and easy to follow.",
    passiveVoiceFeedback:
      passiveSignals > 3
        ? "Passive voice appears frequently. Prefer active verbs where clarity matters."
        : "Passive voice is limited in this sample.",
    readingTimeAt300Wpm: formatReadingTime300Wpm(words),
    adverbs: countAdverbs(text),
    passiveVoiceSentences,
    complexSentences: sentenceComplexity.complexSentences,
    fleschReadingEase,
    fleschKincaidGradeLevel,
  };
}
