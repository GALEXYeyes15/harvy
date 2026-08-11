import type { Editor } from "@tiptap/core";
import { dispatchProofreadDecorations } from "../mechanicsUnderlineLayer";
import { proofreadIssuesToPmRanges } from "../mechanicsUnderlineRanges";
import { proofreadPlainTextAndPositions } from "../proofreadPlainMap";
import type { ProofreadIssue } from "../types";
import { ensureHunspellLoaded } from "./hunspellDictionary";
import { runMechanicsProofread } from "./mechanicsEngine";
import { filterIgnoredMechanicsSuggestions } from "./mechanicsSuggestionIgnore";

function countByType(issues: ProofreadIssue[]): Record<ProofreadIssue["type"], number> {
  return {
    spelling: issues.filter((i) => i.type === "spelling").length,
    grammar: issues.filter((i) => i.type === "grammar").length,
    suggestion: issues.filter((i) => i.type === "suggestion").length,
  };
}

/**
 * Run the local mechanics engine, update React state, and paint overlay underlines.
 * `getExtraIssues` merges on-demand AI check hits so they survive local re-syncs.
 */
export async function syncMechanicsProofread(
  editor: Editor,
  setProofreadIssues: (issues: ProofreadIssue[]) => void,
  getExtraIssues?: () => ProofreadIssue[],
): Promise<ProofreadIssue[]> {
  try {
    await ensureHunspellLoaded();
  } catch {
    // Typo-map spelling still works if dictionary load fails.
  }

  const snapshot = proofreadPlainTextAndPositions(editor.state.doc);

  if (import.meta.env.DEV) {
    console.log("[HarvyMechanics] engine run", { text: snapshot.text });
  }

  const issues = filterIgnoredMechanicsSuggestions(runMechanicsProofread(snapshot.text));
  const extra = getExtraIssues?.() ?? [];
  const merged = extra.length > 0 ? [...issues, ...extra] : issues;

  if (import.meta.env.DEV) {
    console.log("[HarvyMechanics] raw results", issues);
    console.log("[HarvyMechanics] sidebar counts", countByType(merged));
  }

  setProofreadIssues(merged);

  const ranges = proofreadIssuesToPmRanges(merged, snapshot.charToPmPos, snapshot.text);

  if (import.meta.env.DEV) {
    console.log("[HarvyMechanics] overlay underline ranges", {
      issueCount: merged.length,
      rangeCount: ranges.length,
      ranges,
    });
  }

  dispatchProofreadDecorations(editor.view, ranges);

  return merged;
}
