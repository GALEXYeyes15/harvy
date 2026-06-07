import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { openGrammarContextMenu } from "./grammarContextMenu";
import { isGrammarIssueKind, scanTextForGrammarIssues } from "./grammarRules";
import { collectPassiveHits } from "./passiveRules";
import { collectSentenceComplexityDecorationsForDoc } from "./sentenceComplexityDecorations";
import { writingPrefsRef } from "./writingAssistanceSettings";

export const grammarDecorationsKey = new PluginKey<DecorationSet>("harvyGrammarDecorations");
export const writingAssistanceViewRef = {
  showReadabilityHighlights: false,
};

type DocRange = { from: number; to: number };

function mergeOverlappingRanges(ranges: DocRange[]): DocRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.from - b.from || a.to - b.to);
  const out: DocRange[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const prev = out[out.length - 1]!;
    const cur = sorted[i]!;
    if (cur.from <= prev.to) {
      prev.to = Math.max(prev.to, cur.to);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** Remove prose-highlight spans from a complex-sentence range so colors stay distinct. */
function subtractRanges(range: DocRange, exclusions: DocRange[]): DocRange[] {
  const merged = mergeOverlappingRanges(
    exclusions.filter((ex) => ex.from < range.to && ex.to > range.from),
  );
  if (merged.length === 0) return [range];

  const out: DocRange[] = [];
  let cursor = range.from;
  for (const ex of merged) {
    const start = Math.max(ex.from, range.from);
    const end = Math.min(ex.to, range.to);
    if (cursor < start) out.push({ from: cursor, to: start });
    cursor = Math.max(cursor, end);
  }
  if (cursor < range.to) out.push({ from: cursor, to: range.to });
  return out;
}

function isProseGrammarHighlightKind(kind: string): boolean {
  return kind === "adverb-hint" || kind === "passive-voice";
}

function buildDecorationSet(doc: ProseMirrorNode): DecorationSet {
  const showEdit = writingAssistanceViewRef.showReadabilityHighlights;
  if (!showEdit) {
    return DecorationSet.empty;
  }

  const decos: Decoration[] = [];
  const proseHighlightRanges: DocRange[] = [];
  let debugSentence = false;
  let debugDocPassiveHitCount = 0;

  if (writingPrefsRef.grammarChecks) {
    const docPlain = doc.textContent ?? "";
    debugSentence =
      import.meta.env.DEV &&
      /framework was designed to simplify decisions, yet it was often misunderstood by those who encountered it/i.test(
        docPlain,
      );
    if (debugSentence) {
      const passiveHits = collectPassiveHits(docPlain);
      debugDocPassiveHitCount = passiveHits.length;
      // eslint-disable-next-line no-console
      console.log("[HarvyPassiveRenderDebug] doc passive hits", {
        passiveCount: passiveHits.length,
        passiveHits: passiveHits.map((h) => docPlain.slice(h.start, h.end)),
      });
    }
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return true;
      if (node.marks.some((mk) => mk.type.name === "code" || mk.type.name === "link")) {
        return true;
      }

      const issues = scanTextForGrammarIssues(node.text);
      if (debugSentence) {
        const passiveIssues = issues.filter((i) => i.kind === "passive-voice");
        // eslint-disable-next-line no-console
        console.log("[HarvyPassiveRenderDebug] node passive issues", {
          nodePos: pos,
          nodeText: node.text,
          passiveIssues: passiveIssues.map((i) => node.text?.slice(i.start, i.end) ?? ""),
        });
      }
      const nodeEnd = pos + node.nodeSize;
      for (const issue of issues) {
        const from = pos + issue.start;
        const to = pos + issue.end;
        if (from < to && from >= pos && to <= nodeEnd) {
          decos.push(
            Decoration.inline(from, to, {
              class: `harvy-grammar harvy-grammar-${issue.kind}`,
              "data-harvy-grammar": issue.kind,
              "data-harvy-from": String(from),
              "data-harvy-to": String(to),
            }),
          );
          if (isProseGrammarHighlightKind(issue.kind)) {
            proseHighlightRanges.push({ from, to });
          }
        }
      }
      return true;
    });
  }

  const sentenceMetrics = collectSentenceComplexityDecorationsForDoc(doc);
  for (const deco of sentenceMetrics.decorations) {
    const pieces = subtractRanges({ from: deco.from, to: deco.to }, proseHighlightRanges);
    for (const piece of pieces) {
      if (piece.from >= piece.to) continue;
      decos.push(deco.copy(piece.from, piece.to));
    }
  }
  if (import.meta.env.DEV && showEdit) {
    // eslint-disable-next-line no-console
    console.log("[HarvySentenceComplexity]", {
      complexSentences: sentenceMetrics.complexCount,
      totalSentenceDecorations: sentenceMetrics.decorations.length,
    });
  }

  if (debugSentence) {
    const passiveDecorationCount = decos.filter((d) => {
      const spec = d.spec as { class?: string } | undefined;
      return Boolean(spec?.class?.includes("harvy-grammar-passive-voice"));
    }).length;
    if (debugDocPassiveHitCount > passiveDecorationCount) {
      // eslint-disable-next-line no-console
      console.log("[HarvyPassiveRenderDebug] passive hit detected but may be hidden by overlapping decoration", {
        docPassiveHits: debugDocPassiveHitCount,
        passiveDecorations: passiveDecorationCount,
      });
    }
  }

  return DecorationSet.create(doc, decos);
}

export const WritingAssistance = Extension.create({
  name: "writingAssistance",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: grammarDecorationsKey,
        state: {
          init: (_, { doc }) => buildDecorationSet(doc),
          apply(tr, oldSet) {
            if (!writingAssistanceViewRef.showReadabilityHighlights) {
              return DecorationSet.empty;
            }
            if (tr.docChanged || tr.getMeta(grammarDecorationsKey)) {
              return buildDecorationSet(tr.doc);
            }
            return oldSet.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return grammarDecorationsKey.getState(state) ?? null;
          },
          handleDOMEvents: {
            contextmenu(view, event) {
              const el = (event.target as HTMLElement | null)?.closest?.(
                "[data-harvy-grammar]",
              ) as HTMLElement | null;
              if (!el || !view.dom.contains(el)) return false;
              if (!writingPrefsRef.grammarChecks || !writingAssistanceViewRef.showReadabilityHighlights) {
                return false;
              }

              const from = Number(el.getAttribute("data-harvy-from"));
              const to = Number(el.getAttribute("data-harvy-to"));
              const rawKind = el.getAttribute("data-harvy-grammar");
              if (!Number.isFinite(from) || !Number.isFinite(to) || !rawKind || !isGrammarIssueKind(rawKind)) {
                return false;
              }
              const kind = rawKind;

              event.preventDefault();
              openGrammarContextMenu({
                clientX: event.clientX,
                clientY: event.clientY,
                view,
                from,
                to,
                kind,
              });
              return true;
            },
          },
        },
      }),
    ];
  },
});
