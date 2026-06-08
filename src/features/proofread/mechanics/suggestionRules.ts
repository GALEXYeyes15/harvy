import type { MechanicsRuleHit } from "./types";

const LONG_SENTENCE_WORD_THRESHOLD = 38;

const FILLER_PHRASES: ReadonlyArray<{ pattern: RegExp; message: string }> = [
  { pattern: /\bkind of\b/gi, message: "Consider a more direct phrase than “kind of”" },
  { pattern: /\bsort of\b/gi, message: "Consider a more direct phrase than “sort of”" },
  { pattern: /\bbasically\b/gi, message: "“Basically” is often filler" },
  { pattern: /\breally\b/gi, message: "“Really” may weaken your point" },
  { pattern: /\bvery\b/gi, message: "“Very” is often unnecessary" },
  { pattern: /\bjust\b/gi, message: "“Just” can be filler" },
];

const WORDY_PHRASES: ReadonlyArray<{ pattern: RegExp; replacement: string; message: string }> = [
  { pattern: /\bin order to\b/gi, replacement: "to", message: "“In order to” can be shortened to “to”" },
  {
    pattern: /\bdue to the fact that\b/gi,
    replacement: "because",
    message: "“Due to the fact that” can be shortened to “because”",
  },
  {
    pattern: /\bat this point in time\b/gi,
    replacement: "now",
    message: "“At this point in time” can be shortened to “now”",
  },
];

const PASSIVE_ISH: ReadonlyArray<{ pattern: RegExp; message: string }> = [
  { pattern: /\bwas being\b/gi, message: "Passive construction — consider active voice" },
  { pattern: /\bis being\b/gi, message: "Passive construction — consider active voice" },
  { pattern: /\bwere being\b/gi, message: "Passive construction — consider active voice" },
  { pattern: /\bhas been\b/gi, message: "Passive construction — consider active voice" },
];

function pushUnique(hits: MechanicsRuleHit[], next: MechanicsRuleHit): void {
  const overlaps = hits.some(
    (hit) => hit.category === next.category && !(next.end <= hit.start || next.start >= hit.end),
  );
  if (!overlaps) hits.push(next);
}

function splitSentences(text: string): Array<{ text: string; start: number; end: number }> {
  const sentences: Array<{ text: string; start: number; end: number }> = [];
  const re = /[^.!?\n]+[.!?]?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const slice = match[0].trim();
    if (!slice) continue;
    const leading = match[0].match(/^\s*/)?.[0]?.length ?? 0;
    const start = match.index + leading;
    const end = start + slice.length;
    sentences.push({ text: slice, start, end });
  }
  return sentences;
}

function countWords(sentence: string): number {
  const words = sentence.match(/\b[\w']+\b/g);
  return words?.length ?? 0;
}

/** Flag sentences longer than ~35–40 words. */
function scanLongSentences(text: string, hits: MechanicsRuleHit[]): void {
  for (const sentence of splitSentences(text)) {
    if (countWords(sentence.text) < LONG_SENTENCE_WORD_THRESHOLD) continue;
    pushUnique(hits, {
      category: "suggestion",
      message: `Long sentence (${countWords(sentence.text)} words) — consider splitting`,
      start: sentence.start,
      end: sentence.end,
      severity: "low",
    });
  }
}

/** Flag when nearby sentences share the same opening words. */
function scanRepeatedSentenceOpenings(text: string, hits: MechanicsRuleHit[]): void {
  const sentences = splitSentences(text);
  for (let i = 1; i < sentences.length; i++) {
    const prev = sentences[i - 1]!;
    const curr = sentences[i]!;
    const prevOpen = prev.text.match(/^(\S+(?:\s+\S+){0,2})/)?.[1]?.toLowerCase();
    const currOpen = curr.text.match(/^(\S+(?:\s+\S+){0,2})/)?.[1]?.toLowerCase();
    if (!prevOpen || !currOpen || prevOpen !== currOpen) continue;
    const openLen = curr.text.match(/^(\S+(?:\s+\S+){0,2})/)?.[1]?.length ?? 0;
    if (openLen < 3) continue;
    pushUnique(hits, {
      category: "suggestion",
      message: `Repeated sentence opening (“${currOpen}”)` ,
      start: curr.start,
      end: curr.start + openLen,
      severity: "low",
    });
  }
}

/** Filler and hedge words. */
function scanFillerPhrases(text: string, hits: MechanicsRuleHit[]): void {
  for (const { pattern, message } of FILLER_PHRASES) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      pushUnique(hits, {
        category: "suggestion",
        message,
        start: match.index,
        end: match.index + match[0].length,
        severity: "low",
      });
    }
  }
}

/** Wordy multi-word phrases with shorter replacements. */
function scanWordyPhrases(text: string, hits: MechanicsRuleHit[]): void {
  for (const { pattern, replacement, message } of WORDY_PHRASES) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      const original = match[0];
      const fixed =
        original[0] === original[0]!.toUpperCase()
          ? replacement[0]!.toUpperCase() + replacement.slice(1)
          : replacement;
      pushUnique(hits, {
        category: "suggestion",
        message,
        replacement: fixed,
        start: match.index,
        end: match.index + original.length,
        severity: "low",
      });
    }
  }
}

/** Passive-ish “to be + being / been” constructions. */
function scanPassiveIsh(text: string, hits: MechanicsRuleHit[]): void {
  for (const { pattern, message } of PASSIVE_ISH) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      pushUnique(hits, {
        category: "suggestion",
        message,
        start: match.index,
        end: match.index + match[0].length,
        severity: "low",
      });
    }
  }
}

/** Repeated non-trivial words within the same sentence. */
function scanIntraSentenceRepeatedWords(text: string, hits: MechanicsRuleHit[]): void {
  for (const sentence of splitSentences(text)) {
    const words: Array<{ word: string; start: number; end: number }> = [];
    const re = /\b([A-Za-z]{4,})\b/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(sentence.text)) !== null) {
      words.push({
        word: match[1]!.toLowerCase(),
        start: sentence.start + match.index,
        end: sentence.start + match.index + match[1]!.length,
      });
    }

    const seen = new Map<string, number>();
    for (const entry of words) {
      const count = (seen.get(entry.word) ?? 0) + 1;
      seen.set(entry.word, count);
      if (count === 2) {
        pushUnique(hits, {
          category: "suggestion",
          message: `“${entry.word}” is repeated in this sentence`,
          start: entry.start,
          end: entry.end,
          severity: "low",
        });
      }
    }
  }
}

/** Readability and style heuristics (not AI rewrites). */
export function scanSuggestionIssues(text: string): MechanicsRuleHit[] {
  if (text.length < 2) return [];

  const hits: MechanicsRuleHit[] = [];
  scanLongSentences(text, hits);
  scanRepeatedSentenceOpenings(text, hits);
  scanFillerPhrases(text, hits);
  scanWordyPhrases(text, hits);
  scanPassiveIsh(text, hits);
  scanIntraSentenceRepeatedWords(text, hits);
  return hits.sort((a, b) => a.start - b.start);
}
