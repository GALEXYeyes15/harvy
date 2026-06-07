import { getCompiledEditorRules } from "./editorRules";

export type AdverbHit = {
  start: number;
  end: number;
  word: string;
};

/** Collect blue clarity spans (adverbs + weak phrasing) for counts + highlights. */
export function collectAdverbHits(text: string): AdverbHit[] {
  const { adverbs } = getCompiledEditorRules();
  const out: AdverbHit[] = [];

  const ly = new RegExp(adverbs.lyRe.source, adverbs.lyRe.flags);
  let m: RegExpExecArray | null;
  while ((m = ly.exec(text)) !== null) {
    const word = m[0].toLowerCase();
    if (adverbs.ignoreLy.has(word)) continue;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      word,
    });
  }

  const plain = /\b[a-z]{3,}\b/gi;
  while ((m = plain.exec(text)) !== null) {
    const word = m[0].toLowerCase();
    if (!adverbs.nonLy.has(word)) continue;
    out.push({
      start: m.index,
      end: m.index + m[0].length,
      word,
    });
  }

  for (const baseRe of adverbs.hedgingRes) {
    const re = new RegExp(baseRe.source, baseRe.flags);
    let pm: RegExpExecArray | null;
    while ((pm = re.exec(text)) !== null) {
      out.push({
        start: pm.index,
        end: pm.index + pm[0].length,
        word: pm[0].toLowerCase(),
      });
    }
  }

  out.sort((a, b) => a.start - b.start || a.end - b.end);
  const deduped: AdverbHit[] = [];
  for (const hit of out) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.start === hit.start && prev.end === hit.end) continue;
    deduped.push(hit);
  }
  return deduped;
}
