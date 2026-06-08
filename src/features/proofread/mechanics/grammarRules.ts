import type { MechanicsRuleHit } from "./types";

function pushUnique(hits: MechanicsRuleHit[], next: MechanicsRuleHit): void {
  const overlaps = hits.some(
    (hit) => hit.category === next.category && !(next.end <= hit.start || next.start >= hit.end),
  );
  if (!overlaps) hits.push(next);
}

/** Repeated words such as “the the” or “and and”. Underlines the second word only. */
function scanRepeatedWords(text: string, hits: MechanicsRuleHit[]): void {
  const repeat = /\b([A-Za-z]{2,})\s+\1\b/gi;
  let match: RegExpExecArray | null;
  while ((match = repeat.exec(text)) !== null) {
    const word = match[1]!;
    const afterFirst = match[0].slice(word.length);
    const ws = afterFirst.match(/^\s+/);
    const wsLen = ws ? ws[0]!.length : 1;
    const secondStart = match.index + word.length + wsLen;
    pushUnique(hits, {
      category: "grammar",
      message: "Repeated word",
      replacement: "",
      start: secondStart,
      end: secondStart + word.length,
      severity: "medium",
    });
  }
}

/** Two or more consecutive spaces (not newlines). */
function scanDoubleSpaces(text: string, hits: MechanicsRuleHit[]): void {
  const multiSpace = / {2,}/g;
  let match: RegExpExecArray | null;
  while ((match = multiSpace.exec(text)) !== null) {
    pushUnique(hits, {
      category: "grammar",
      message: "Extra space",
      replacement: " ",
      start: match.index,
      end: match.index + match[0].length,
      severity: "low",
    });
  }
}

/** Lowercase letter immediately after sentence-ending punctuation. */
function scanLowercaseAfterPeriod(text: string, hits: MechanicsRuleHit[]): void {
  const re = /([.!?][)"']*)\s+([a-z])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const letter = match[2]!;
    const start = match.index + match[0].length - 1;
    pushUnique(hits, {
      category: "grammar",
      message: "Sentence should start with a capital letter",
      replacement: letter.toUpperCase(),
      start,
      end: start + 1,
      severity: "medium",
    });
  }
}

/** Standalone lowercase “i” should be capitalized. */
function scanLowercaseI(text: string, hits: MechanicsRuleHit[]): void {
  const re = /(?<![A-Za-z])i(?![A-Za-z])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    pushUnique(hits, {
      category: "grammar",
      message: 'Capitalize “I” when used as a pronoun',
      replacement: "I",
      start: match.index,
      end: match.index + 1,
      severity: "medium",
    });
  }
}

/** Space before punctuation, e.g. “hello , world”. */
function scanSpaceBeforePunctuation(text: string, hits: MechanicsRuleHit[]): void {
  const re = /[ \t]+([.,;:!?])(?=[ \t\n]|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const punctStart = match.index + match[0].length - 1;
    pushUnique(hits, {
      category: "grammar",
      message: "Remove space before punctuation",
      replacement: match[1]!,
      start: match.index,
      end: punctStart + 1,
      severity: "medium",
    });
  }
}

/** Missing space after sentence punctuation, e.g. “Hello.World”. */
function scanMissingSpaceAfterPunctuation(text: string, hits: MechanicsRuleHit[]): void {
  const re = /([.!?])([A-Za-z])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    pushUnique(hits, {
      category: "grammar",
      message: "Add a space after punctuation",
      replacement: `${match[1]!} ${match[2]!}`,
      start: match.index,
      end: match.index + match[0].length,
      severity: "medium",
    });
  }
}

/** Unmatched straight double quotes in the document. */
function scanUnmatchedQuotes(text: string, hits: MechanicsRuleHit[]): void {
  let quoteCount = 0;
  let firstUnpaired = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '"') continue;
    if (quoteCount % 2 === 0) firstUnpaired = i;
    quoteCount++;
  }
  if (quoteCount % 2 === 1 && firstUnpaired >= 0) {
    pushUnique(hits, {
      category: "grammar",
      message: "Unmatched quotation mark",
      start: firstUnpaired,
      end: firstUnpaired + 1,
      severity: "medium",
    });
  }
}

/** Unmatched parentheses — flags the first unclosed “(”. */
function scanUnmatchedParentheses(text: string, hits: MechanicsRuleHit[]): void {
  let depth = 0;
  let firstOpen = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") {
      if (depth === 0) firstOpen = i;
      depth++;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
      if (depth === 0) firstOpen = -1;
    }
  }
  if (depth > 0 && firstOpen >= 0) {
    pushUnique(hits, {
      category: "grammar",
      message: "Unmatched opening parenthesis",
      start: firstOpen,
      end: firstOpen + 1,
      severity: "medium",
    });
  }
}

/** Common missing-apostrophe contractions. */
function scanBasicContractions(text: string, hits: MechanicsRuleHit[]): void {
  const contractions: ReadonlyArray<{ pattern: RegExp; replacement: string; message: string }> = [
    { pattern: /\bdont\b/gi, replacement: "don't", message: "Use “don't”" },
    { pattern: /\bcant\b/gi, replacement: "can't", message: "Use “can't”" },
    { pattern: /\bwont\b/gi, replacement: "won't", message: "Use “won't”" },
  ];

  for (const rule of contractions) {
    let match: RegExpExecArray | null;
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    while ((match = re.exec(text)) !== null) {
      const word = match[0];
      const fixed =
        word[0] === word[0]!.toUpperCase()
          ? rule.replacement[0]!.toUpperCase() + rule.replacement.slice(1)
          : rule.replacement;
      pushUnique(hits, {
        category: "grammar",
        message: rule.message,
        replacement: fixed,
        start: match.index,
        end: match.index + word.length,
        severity: "medium",
      });
    }
  }
}

/** Mechanical grammar and punctuation rules (not style suggestions). */
export function scanGrammarIssues(text: string): MechanicsRuleHit[] {
  if (text.length < 2) return [];

  const hits: MechanicsRuleHit[] = [];
  scanRepeatedWords(text, hits);
  scanDoubleSpaces(text, hits);
  scanLowercaseAfterPeriod(text, hits);
  scanLowercaseI(text, hits);
  scanSpaceBeforePunctuation(text, hits);
  scanMissingSpaceAfterPunctuation(text, hits);
  scanUnmatchedQuotes(text, hits);
  scanUnmatchedParentheses(text, hits);
  scanBasicContractions(text, hits);
  return hits.sort((a, b) => a.start - b.start);
}
