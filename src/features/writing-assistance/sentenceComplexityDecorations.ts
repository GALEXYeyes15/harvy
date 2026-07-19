import type { Node as PmNode } from "@tiptap/pm/model";
import { Decoration } from "@tiptap/pm/view";
import { complexitySourceBlocksFromStored } from "../editor/documentMarkdown";
import type { SentenceComplexityCounts } from "../editor/stats";
import { scoreSentenceComplexity, splitTextIntoSentences, type SentenceComplexityLevel } from "../readability";
import { parametersPrefsRef } from "../settings/parametersSettings";
import {
  hasListItemAncestor,
  isProseSentenceEligible,
  type SentenceBlockKind,
} from "./sentenceComplexityEligibility";

function sentenceComplexityLevel(sentence: string): SentenceComplexityLevel {
  return scoreSentenceComplexity(sentence, parametersPrefsRef.fkComplexityThreshold).level;
}

/**
 * Map each sentence string from `splitIntoSentences(plain)` to `[start, end)` indices in `plain`
 * (sequential `indexOf`, so duplicate sentences resolve in order).
 */
function sentenceSpansInPlain(
  plain: string,
  blockKind: SentenceBlockKind,
): { start: number; end: number; level: SentenceComplexityLevel }[] {
  const sentences = splitTextIntoSentences(plain);
  const out: { start: number; end: number; level: SentenceComplexityLevel }[] = [];
  let searchFrom = 0;

  for (const s of sentences) {
    if (!isProseSentenceEligible(s, blockKind)) {
      const skip = plain.indexOf(s, searchFrom);
      if (skip !== -1) searchFrom = skip + s.length;
      continue;
    }
    const level = sentenceComplexityLevel(s);
    if (level === "normal") {
      const skip = plain.indexOf(s, searchFrom);
      if (skip !== -1) searchFrom = skip + s.length;
      continue;
    }
    const idx = plain.indexOf(s, searchFrom);
    if (idx === -1) continue;
    searchFrom = idx + s.length;
    out.push({ start: idx, end: idx + s.length, level });
  }
  return out;
}

/**
 * Flatten one textblock's inline content to a string and parallel PM positions
 * (before each code unit). Skips `code` marks; treats `hardBreak` as `\n`.
 */
function collectBlockPlainAndPmBefore(block: PmNode, blockPos: number): { plain: string; pmBefore: number[] } {
  const pmBefore: number[] = [];
  let plain = "";
  const base = blockPos + 1;

  block.descendants((node, pos) => {
    if (node.isText && node.text) {
      if (node.marks.some((m) => m.type.name === "code")) {
        return false;
      }
      for (let i = 0; i < node.text.length; i++) {
        pmBefore.push(base + pos + i);
        plain += node.text[i]!;
      }
      return false;
    }
    if (node.type.name === "hardBreak") {
      pmBefore.push(base + pos);
      plain += "\n";
      return false;
    }
    return true;
  });

  pmBefore.push(base + block.content.size);
  return { plain, pmBefore };
}

export type CollectSentenceComplexityOptions = {
  /** When false, only counts are computed (faster; no Decoration allocations). Default true. */
  decorations?: boolean;
};

export function collectSentenceComplexityDecorationsForDoc(
  doc: PmNode,
  opts?: CollectSentenceComplexityOptions,
): {
  decorations: Decoration[];
  complexCount: number;
} {
  const wantDecorations = opts?.decorations !== false;
  const decorations: Decoration[] = [];
  let complexCount = 0;

  doc.descendants((node, pos) => {
    if (!node.isTextblock || !node.inlineContent) return true;
    if (node.childCount === 0) return true;
    if (hasListItemAncestor(doc, pos)) return true;

    const name = node.type.name;
    if (name !== "paragraph" && name !== "heading") return true;

    const blockKind: SentenceBlockKind = name === "heading" ? "heading" : "paragraph";

    const { plain, pmBefore } = collectBlockPlainAndPmBefore(node, pos);
    if (!plain.trim()) return true;

    const spans = sentenceSpansInPlain(plain, blockKind);
    for (const span of spans) {
      if (span.start < 0 || span.end > plain.length || span.start >= span.end) continue;
      if (span.end > pmBefore.length - 1) continue;
      const from = pmBefore[span.start]!;
      const to = pmBefore[span.end]!;
      if (from >= to) continue;

      complexCount += 1;

      if (!wantDecorations) continue;

      const cls = "harvy-sentence-complexity harvy-sentence-complex";

      decorations.push(
        Decoration.inline(from, to, {
          class: cls,
          "data-harvy-sentence-complexity": span.level,
        }),
      );
    }

    return true;
  });

  return { decorations, complexCount };
}

export function countSentenceComplexityInDoc(doc: PmNode): SentenceComplexityCounts {
  const { complexCount } = collectSentenceComplexityDecorationsForDoc(doc, {
    decorations: false,
  });
  return { complexSentences: complexCount };
}

/** When the ProseMirror doc is not mounted, derive the same counts from stored Markdown/HTML. */
export function countSentenceComplexityFromStoredDocument(
  stored: string,
  sourcePath?: string | null,
): SentenceComplexityCounts {
  let complexSentences = 0;

  for (const { text, kind } of complexitySourceBlocksFromStored(stored, { sourcePath: sourcePath ?? null })) {
    for (const s of splitTextIntoSentences(text)) {
      if (!isProseSentenceEligible(s, kind)) continue;
      const level = sentenceComplexityLevel(s);
      if (level === "complex") complexSentences += 1;
    }
  }

  return { complexSentences };
}

export function buildSentenceComplexityDecorations(doc: PmNode): Decoration[] {
  return collectSentenceComplexityDecorationsForDoc(doc).decorations;
}
