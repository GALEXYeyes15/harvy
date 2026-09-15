import type { Editor } from "@tiptap/core";
import { reconcileAiIssuesInText } from "../../aiCheck/aiCheck";
import { dispatchProofreadDecorations, proofreadDecorationsViewRef } from "../mechanicsUnderlineLayer";
import { pmRangeFullyLinked } from "../../related-essays/relatedPhrases";
import { proofreadIssuesToPmRanges } from "../mechanicsUnderlineRanges";
import { proofreadPlainTextAndPositions } from "../proofreadPlainMap";
import type { ProofreadIssue } from "../types";
import { ensureHunspellLoaded } from "./hunspellDictionary";
import { runMechanicsProofread } from "./mechanicsEngine";
import { filterIgnoredMechanicsSuggestions } from "./mechanicsSuggestionIgnore";

/**
 * Run the local mechanics engine, update React state, and paint overlay underlines.
 * `getExtraIssues` merges on-demand AI / related-essay hits so they survive local re-syncs.
 * `setExtraIssues` persists reconciled extra hits after Ignore / Replace / edits.
 */
export async function syncMechanicsProofread(
  editor: Editor,
  setProofreadIssues: (issues: ProofreadIssue[]) => void,
  getExtraIssues?: () => ProofreadIssue[],
  setExtraIssues?: (issues: ProofreadIssue[]) => void,
  options?: { includeLocalMechanics?: boolean },
): Promise<ProofreadIssue[]> {
  const includeLocalMechanics = options?.includeLocalMechanics !== false;

  if (includeLocalMechanics) {
    try {
      await ensureHunspellLoaded();
    } catch {
      // Typo-map spelling still works if dictionary load fails.
    }
  }

  const snapshot = proofreadPlainTextAndPositions(editor.state.doc);

  const issues = includeLocalMechanics
    ? filterIgnoredMechanicsSuggestions(runMechanicsProofread(snapshot.text))
    : [];
  const reconciledExtra = reconcileAiIssuesInText(snapshot.text, getExtraIssues?.() ?? []);
  const extra = filterIgnoredMechanicsSuggestions(reconciledExtra);
  if (setExtraIssues) {
    const remainingExtra = extra.filter(
      (issue) => issue.type === "ai" || issue.type === "related",
    );
    setExtraIssues(remainingExtra);
  }
  const merged = extra.length > 0 ? [...extra, ...issues] : issues;

  setProofreadIssues(merged);

  const ranges = proofreadIssuesToPmRanges(merged, snapshot.charToPmPos, snapshot.text).filter(
    (range) => range.type !== "related" || !pmRangeFullyLinked(editor.state.doc, range.from, range.to),
  );
  const paint = proofreadDecorationsViewRef.relatedOnly
    ? ranges.filter((range) => range.type === "related")
    : ranges;

  dispatchProofreadDecorations(editor.view, paint);

  return merged;
}
