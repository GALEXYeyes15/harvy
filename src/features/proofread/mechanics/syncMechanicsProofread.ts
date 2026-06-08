import type { Editor } from "@tiptap/core";
import { dispatchProofreadDecorations } from "../mechanicsUnderlineLayer";
import { proofreadIssuesToPmRanges } from "../mechanicsUnderlineRanges";
import { proofreadPlainTextAndPositions } from "../proofreadPlainMap";
import type { ProofreadIssue } from "../types";
import { runMechanicsProofread } from "./mechanicsEngine";

function countByType(issues: ProofreadIssue[]): Record<ProofreadIssue["type"], number> {
  return {
    spelling: issues.filter((i) => i.type === "spelling").length,
    grammar: issues.filter((i) => i.type === "grammar").length,
    suggestion: issues.filter((i) => i.type === "suggestion").length,
  };
}

/**
 * Run the local mechanics engine, update React state, and paint overlay underlines.
 * Temporary logging — remove once mechanics pipeline is verified in production.
 */
export function syncMechanicsProofread(
  editor: Editor,
  setProofreadIssues: (issues: ProofreadIssue[]) => void,
): ProofreadIssue[] {
  const snapshot = proofreadPlainTextAndPositions(editor.state.doc);

  console.log("[HarvyMechanics] engine run", { text: snapshot.text });

  const issues = runMechanicsProofread(snapshot.text);

  console.log("[HarvyMechanics] raw results", issues);

  const counts = countByType(issues);
  console.log("[HarvyMechanics] sidebar counts", counts);

  setProofreadIssues(issues);

  const ranges = proofreadIssuesToPmRanges(issues, snapshot.charToPmPos, snapshot.text);
  console.log("[HarvyMechanics] overlay underline ranges", {
    issueCount: issues.length,
    rangeCount: ranges.length,
    ranges,
  });

  dispatchProofreadDecorations(editor.view, ranges);

  return issues;
}
