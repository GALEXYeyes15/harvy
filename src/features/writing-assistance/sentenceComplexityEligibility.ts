import type { Node as PmNode } from "@tiptap/pm/model";
import { normalizeSentenceForAnalysis, wordsInSentence } from "../editor/stats";

export type SentenceBlockKind = "paragraph" | "heading";

/** `pos` is the position immediately before the node (ProseMirror `descendants` callback). */
export function hasListItemAncestor(doc: PmNode, posBeforeNode: number): boolean {
  const $pos = doc.resolve(posBeforeNode + 1);
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === "listItem") return true;
  }
  return false;
}

function looksLikeListOrOutlinePrefix(normalizedLine: string): boolean {
  const t = normalizedLine.trimStart();
  if (!t) return true;
  if (/^[-*+]\s/.test(t)) return true;
  if (/^\d{1,3}[.)]\s/.test(t)) return true;
  if (/^\[[ xX]\]\s/.test(t)) return true;
  if (/^[•◦▪]\s/.test(t)) return true;
  return false;
}

/** Wrapped outline-style lines: every non-empty line is heavily indented. */
function isMultilineIndentedOutline(sentence: string): boolean {
  const lines = sentence.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return false;
  return lines.every((l) => /^(?:\s{2,}|\t+)\S/.test(l));
}

/**
 * Filters out list bullets, numbered prefixes, checkboxes, outline wraps, and short
 * non-prose fragments before sentence complexity thresholds apply.
 */
export function isProseSentenceEligible(sentence: string, blockKind: SentenceBlockKind): boolean {
  const n = normalizeSentenceForAnalysis(sentence);
  if (!n || !/[A-Za-z]/.test(n)) return false;

  const firstLine = sentence.split("\n").find((l) => l.trim().length > 0) ?? "";
  const head = normalizeSentenceForAnalysis(firstLine);
  if (looksLikeListOrOutlinePrefix(head)) return false;

  if (isMultilineIndentedOutline(sentence)) return false;

  const w = wordsInSentence(sentence);
  const endsWithSentencePunct = /[.!?]["')\]]*\s*$/.test(n);

  if (blockKind === "heading") {
    if (w < 8 && !endsWithSentencePunct) return false;
  } else {
    if (w < 5 && !endsWithSentencePunct) return false;
    if (w <= 3 && n.length <= 36 && !endsWithSentencePunct) return false;
  }

  return true;
}
