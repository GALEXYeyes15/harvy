import type { Node as PMNode } from "@tiptap/pm/model";
import type { ProofreadIssue } from "../proofread/types";
import { preferredRelatedUrl, type RelatedEssayItem } from "./relatedEssays";

export const MAX_RELATED_LINKS = 2;
export const RELATED_PHRASE_MIN_CHARS = 8;
export const RELATED_PHRASE_MAX_CHARS = 400;

export function normalizeRelatedUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

export function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function collectDocLinkHrefs(doc: PMNode): string[] {
  const hrefs: string[] = [];
  doc.descendants((node) => {
    if (!node.isText) return;
    for (const mark of node.marks) {
      if (mark.type.name !== "link") continue;
      const href = typeof mark.attrs.href === "string" ? mark.attrs.href.trim() : "";
      if (href) hrefs.push(href);
    }
  });
  return hrefs;
}

export function uniqueLinkedRelatedPaths(opts: {
  linkedPaths: readonly string[];
  items: readonly RelatedEssayItem[];
  hrefs: readonly string[];
}): string[] {
  const urlToPath = new Map<string, string>();
  for (const item of opts.items) {
    const path = item.path.trim();
    const url = preferredRelatedUrl(item);
    if (!path || !url) continue;
    urlToPath.set(normalizeRelatedUrl(url), path);
  }
  const fromHrefs = opts.hrefs
    .map((href) => urlToPath.get(normalizeRelatedUrl(href)) ?? "")
    .filter(Boolean);
  return uniqueStrings([...opts.linkedPaths, ...fromHrefs]);
}

/** Sentence spans in `essay` (offsets into the original string). */
export function essaySentenceSpans(essay: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  const re = /[^.!?]+(?:[.!?]+|$)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(essay)) !== null) {
    const raw = match[0];
    const leading = raw.match(/^\s*/)?.[0]?.length ?? 0;
    const trailing = raw.match(/\s*$/)?.[0]?.length ?? 0;
    const start = match.index + leading;
    const end = match.index + raw.length - trailing;
    if (start < end) spans.push({ start, end });
  }
  return spans;
}

/** Expand a phrase hit to its containing sentence, never past one sentence boundary. */
export function clampRelatedPhraseToOneSentence(
  essay: string,
  phraseStart: number,
  phraseEnd: number,
): { start: number; end: number } | null {
  if (phraseStart < 0 || phraseEnd <= phraseStart || phraseEnd > essay.length) return null;
  const spans = essaySentenceSpans(essay);
  const hit = spans.find((span) => phraseStart >= span.start && phraseStart < span.end);
  if (!hit) return null;
  return { start: hit.start, end: hit.end };
}

export function locateRelatedPhrasesInText(
  essay: string,
  items: readonly RelatedEssayItem[],
): ProofreadIssue[] {
  const located: ProofreadIssue[] = [];
  const usedSentences = new Set<string>();
  let searchFrom = 0;

  for (const item of items) {
    const phrase = item.phrase?.trim() ?? "";
    if (phrase.length < RELATED_PHRASE_MIN_CHARS || phrase.length > RELATED_PHRASE_MAX_CHARS) {
      continue;
    }

    let start = essay.indexOf(phrase, searchFrom);
    if (start < 0) {
      start = essay.indexOf(phrase);
    }
    if (start < 0) continue;

    const clamped = clampRelatedPhraseToOneSentence(essay, start, start + phrase.length);
    if (!clamped) continue;
    const sentence = essay.slice(clamped.start, clamped.end);
    if (sentence.length < RELATED_PHRASE_MIN_CHARS || sentence.length > RELATED_PHRASE_MAX_CHARS) {
      continue;
    }
    const sentenceKey = `${clamped.start}:${clamped.end}`;
    if (usedSentences.has(sentenceKey)) continue;
    usedSentences.add(sentenceKey);

    located.push({
      type: "related",
      text: sentence,
      message: item.why?.trim() || "Related idea in another essay.",
      start: clamped.start,
      end: clamped.end,
      relatedPath: item.path.trim() || undefined,
      relatedUrl: preferredRelatedUrl(item) || undefined,
      relatedTitle: item.title.trim() || undefined,
    });
    searchFrom = clamped.end;
  }

  return located;
}

export function pmRangeFullyLinked(doc: PMNode, from: number, to: number): boolean {
  if (from >= to) return false;
  let sawText = false;
  let allLinked = true;
  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    const start = Math.max(from, pos);
    const end = Math.min(to, pos + node.nodeSize);
    if (start >= end) return;
    sawText = true;
    if (!node.marks.some((mark) => mark.type.name === "link")) {
      allLinked = false;
    }
  });
  return sawText && allLinked;
}

export function relatedIssuesAfterLinking(
  issues: readonly ProofreadIssue[],
  linkedPaths: readonly string[],
  justLinked: string | { path?: string; start?: number; end?: number },
): ProofreadIssue[] {
  const linkedIssue = typeof justLinked === "string" ? { path: justLinked } : justLinked;
  const justPath = linkedIssue.path?.trim() ?? "";
  const nextLinked = uniqueStrings([...linkedPaths, justPath]);
  if (nextLinked.length >= MAX_RELATED_LINKS) return [];
  const linked = new Set(nextLinked);
  return issues.filter((issue) => {
    if (issue.relatedPath && linked.has(issue.relatedPath)) return false;
    if (
      linkedIssue.start != null &&
      linkedIssue.end != null &&
      issue.start === linkedIssue.start &&
      issue.end === linkedIssue.end
    ) {
      return false;
    }
    return true;
  });
}
