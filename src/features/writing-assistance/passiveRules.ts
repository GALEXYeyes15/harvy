import { getCompiledEditorRules, normalizePhrase } from "./editorRules";

export type PassiveHit = {
  start: number;
  end: number;
};

type Tok = { text: string; start: number; end: number };

/** Word tokenization for passive detection (engine). */
function tokenizeWords(text: string): Tok[] {
  const out: Tok[] = [];
  const re = /\b[\w'-]+\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({
      text: m[0]!,
      start: m.index,
      end: m.index + m[0]!.length,
    });
  }
  return out;
}

function isParticiple(word: string, irregular: Set<string>, suffix: RegExp): boolean {
  const w = word.toLowerCase();
  if (EXTRA_IRREGULAR_PARTICIPLES.has(w)) return true;
  if (irregular.has(w)) return true;
  return suffix.test(w);
}

const PASSIVE_LOOKAHEAD_TOKENS = 3;
const EXTRA_IRREGULAR_PARTICIPLES = new Set([
  // Common irregular participles that do not end in `ed|en`.
  "understood",
  "misunderstood",
  "bought",
  "brought",
  "caught",
  "fought",
  "thought",
  "seen",
  "added",
  "connected",
  "ignored",
]);
const PASSIVE_MODIFIER_WORDS = new Set([
  "often",
  "usually",
  "sometimes",
  "rarely",
  "never",
  "always",
  "already",
  "still",
  "just",
  "also",
  "very",
  "too",
  "so",
  "quite",
  "rather",
  "intentionally",
  "carefully",
  "frequently",
  "commonly",
  "generally",
  "widely",
  "easily",
]);

function isPassiveModifier(word: string): boolean {
  const w = word.toLowerCase();
  return PASSIVE_MODIFIER_WORDS.has(w) || /ly$/.test(w);
}

function spanMatchesPassiveException(
  text: string,
  start: number,
  end: number,
  exceptions: Set<string>,
): boolean {
  if (exceptions.size === 0) return false;
  const span = normalizePhrase(text.slice(start, end));
  if (!span) return false;
  return exceptions.has(span);
}

export function collectPassiveHits(text: string): PassiveHit[] {
  const { passive } = getCompiledEditorRules();
  const toks = tokenizeWords(text);
  const out: PassiveHit[] = [];
  const isDebugSentence =
    import.meta.env.DEV &&
    /at first, the process seemed straightforward, but as more layers were added/i.test(text);
  for (let i = 0; i < toks.length - 1; i++) {
    const be = toks[i]!;
    if (!passive.beForms.has(be.text.toLowerCase())) continue;

    let part: Tok | null = null;
    let rejectedByNonModifier = false;
    for (let step = 1; step <= PASSIVE_LOOKAHEAD_TOKENS; step++) {
      const cand = toks[i + step];
      if (!cand) break;
      if (isParticiple(cand.text, passive.irregularParticiples, passive.participleSuffix)) {
        part = cand;
        break;
      }
      if (!isPassiveModifier(cand.text)) {
        part = null;
        rejectedByNonModifier = true;
        break;
      }
    }
    if (!part) {
      if (isDebugSentence && rejectedByNonModifier) {
        // eslint-disable-next-line no-console
        console.log("[HarvyPassiveDebug] reject:no-participle-after-modifiers", {
          be: be.text,
          window: toks
            .slice(i + 1, i + 1 + PASSIVE_LOOKAHEAD_TOKENS)
            .map((t) => t.text.toLowerCase()),
        });
      }
      continue;
    }

    if (spanMatchesPassiveException(text, be.start, part.end, passive.exceptionPhrasesNorm)) {
      if (isDebugSentence) {
        // eslint-disable-next-line no-console
        console.log("[HarvyPassiveDebug] reject:exception-phrase", {
          span: text.slice(be.start, part.end),
        });
      }
      continue;
    }

    out.push({ start: be.start, end: part.end });
  }

  out.sort((a, b) => a.start - b.start || a.end - b.end);
  const deduped: PassiveHit[] = [];
  for (const h of out) {
    const prev = deduped[deduped.length - 1];
    if (prev && !(h.end <= prev.start || h.start >= prev.end)) continue;
    deduped.push(h);
  }
  if (isDebugSentence) {
    // eslint-disable-next-line no-console
    console.log(
      "[HarvyPassiveDebug] accepted",
      deduped.map((h) => text.slice(h.start, h.end)),
    );
  }
  return deduped;
}
