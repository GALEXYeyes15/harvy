/** High-frequency English words — used to rank fuzzy matches, not for validity. */
const COMMON_WORD_FREQUENCY = new Set([
  "a",
  "about",
  "after",
  "again",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "back",
  "be",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "but",
  "by",
  "can",
  "come",
  "could",
  "day",
  "did",
  "do",
  "does",
  "each",
  "even",
  "every",
  "first",
  "for",
  "from",
  "get",
  "go",
  "good",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "him",
  "his",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "know",
  "like",
  "look",
  "make",
  "many",
  "may",
  "me",
  "more",
  "most",
  "much",
  "must",
  "my",
  "new",
  "no",
  "not",
  "now",
  "of",
  "off",
  "on",
  "one",
  "only",
  "or",
  "other",
  "our",
  "out",
  "over",
  "own",
  "people",
  "receive",
  "right",
  "said",
  "same",
  "say",
  "see",
  "she",
  "should",
  "so",
  "some",
  "such",
  "take",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "think",
  "this",
  "those",
  "through",
  "time",
  "to",
  "too",
  "two",
  "under",
  "up",
  "use",
  "very",
  "want",
  "was",
  "way",
  "we",
  "well",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "will",
  "with",
  "work",
  "would",
  "write",
  "year",
  "you",
  "your",
]);

export function maxFuzzyEditDistance(wordLength: number): number {
  if (wordLength <= 3) return 1;
  if (wordLength <= 6) return 2;
  return 3;
}

/** Levenshtein distance, or null when above `maxDistance`. */
export function levenshteinWithin(a: string, b: string, maxDistance: number): number | null {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maxDistance) return null;

  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen <= maxDistance ? bLen : null;
  if (bLen === 0) return aLen <= maxDistance ? aLen : null;

  let prev = new Array<number>(bLen + 1);
  let curr = new Array<number>(bLen + 1);

  for (let j = 0; j <= bLen; j++) prev[j] = j;

  for (let i = 1; i <= aLen; i++) {
    curr[0] = i;
    let rowMin = curr[0]!;

    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
      if (curr[j]! < rowMin) rowMin = curr[j]!;
    }

    if (rowMin > maxDistance) return null;

    const swap = prev;
    prev = curr;
    curr = swap;
  }

  const dist = prev[bLen]!;
  return dist <= maxDistance ? dist : null;
}

function rankFuzzyCandidate(target: string, candidate: string, distance: number): number {
  let score = distance * 100;
  if (candidate[0] !== target[0]) score += 12;
  score += Math.abs(candidate.length - target.length) * 4;
  if (COMMON_WORD_FREQUENCY.has(candidate)) score -= 8;
  return score;
}

/**
 * Fuzzy dictionary search for likely spellings when Hunspell returns nothing useful.
 * Returns lowercase candidates ranked by likely match quality.
 */
export function fuzzySpellingSuggestions(
  lookupWord: string,
  dictionaryWords: readonly string[],
  limit: number,
  exclude: ReadonlySet<string> = new Set(),
): string[] {
  if (limit <= 0 || lookupWord.length <= 2 || dictionaryWords.length === 0) return [];

  const maxDistance = maxFuzzyEditDistance(lookupWord.length);
  const minLen = lookupWord.length - maxDistance;
  const maxLen = lookupWord.length + maxDistance;

  const ranked: Array<{ word: string; score: number }> = [];

  for (const candidate of dictionaryWords) {
    if (candidate.length < minLen || candidate.length > maxLen) continue;
    if (candidate === lookupWord || exclude.has(candidate)) continue;

    const distance = levenshteinWithin(lookupWord, candidate, maxDistance);
    if (distance === null) continue;

    ranked.push({
      word: candidate,
      score: rankFuzzyCandidate(lookupWord, candidate, distance),
    });
  }

  ranked.sort((a, b) => a.score - b.score || a.word.localeCompare(b.word));

  const out: string[] = [];
  const seen = new Set<string>();

  for (const entry of ranked) {
    if (seen.has(entry.word)) continue;
    seen.add(entry.word);
    out.push(entry.word);
    if (out.length >= limit) break;
  }

  return out;
}
