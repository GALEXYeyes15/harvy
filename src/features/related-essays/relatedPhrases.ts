import type { Node as PMNode } from "@tiptap/pm/model";
import type { ProofreadIssue } from "../proofread/types";
import { preferredRelatedUrl, type RelatedEssayItem } from "./relatedEssays";

export const MAX_RELATED_LINKS = 2;
export const RELATED_PHRASE_MIN_CHARS = 8;
export const RELATED_PHRASE_MAX_CHARS = 120;

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

export function locateRelatedPhrasesInText(
  essay: string,
  items: readonly RelatedEssayItem[],
): ProofreadIssue[] {
  const located: ProofreadIssue[] = [];
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

    const end = start + phrase.length;
    located.push({
      type: "related",
      text: phrase,
      message: item.why?.trim() || "Related idea in another essay.",
      start,
      end,
      relatedPath: item.path.trim() || undefined,
      relatedUrl: preferredRelatedUrl(item) || undefined,
      relatedTitle: item.title.trim() || undefined,
    });
    searchFrom = end;
  }

  return located;
}

export function relatedIssuesAfterLinking(
  issues: readonly ProofreadIssue[],
  linkedPaths: readonly string[],
  justLinkedPath: string,
): ProofreadIssue[] {
  const nextLinked = uniqueStrings([...linkedPaths, justLinkedPath]);
  if (nextLinked.length >= MAX_RELATED_LINKS) return [];
  const linked = new Set(nextLinked);
  return issues.filter((issue) => !issue.relatedPath || !linked.has(issue.relatedPath));
}
