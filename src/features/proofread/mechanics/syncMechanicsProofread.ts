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
 */
export async function syncMechanicsProofread(
  editor: Editor,
  setProofreadIssues: (issues: ProofreadIssue[]) => void,
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

  if (import.meta.env.DEV) {
    console.log("[HarvyMechanics] raw results", issues);
    console.log("[HarvyMechanics] sidebar counts", countByType(issues));
  }

  setProofreadIssues(issues);

  const ranges = proofreadIssuesToPmRanges(issues, snapshot.charToPmPos, snapshot.text);

  if (import.meta.env.DEV) {
    console.log("[HarvyMechanics] overlay underline ranges", {
      issueCount: issues.length,
      rangeCount: ranges.length,
      ranges,
    });
  }

  dispatchProofreadDecorations(editor.view, ranges);

  return issues;
}
