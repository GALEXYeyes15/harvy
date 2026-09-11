import type { ProofreadIssue } from "../types";
import { scanGrammarIssues } from "./grammarRules";
import { scanSpellingIssues } from "./spellingChecker";
import { scanSuggestionIssues } from "./suggestionRules";
import type { MechanicsRule, MechanicsRuleHit } from "./types";

/** All registered mechanics rules. Add new entries here to extend the engine. */
const MECHANICS_RULES: MechanicsRule[] = [
  { id: "spelling-common-typos", category: "spelling", scan: scanSpellingIssues },
  { id: "grammar-mechanical", category: "grammar", scan: scanGrammarIssues },
  { id: "suggestion-readability", category: "suggestion", scan: scanSuggestionIssues },
];

const SEVERITY_RANK: Record<NonNullable<MechanicsRuleHit["severity"]>, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function hitLength(hit: MechanicsRuleHit): number {
  return hit.end - hit.start;
}

/** Drop overlapping hits; prefer longer spans, then higher severity, then earlier rules. */
function dedupeHits(hits: MechanicsRuleHit[]): MechanicsRuleHit[] {
  const sorted = [...hits].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const lenDiff = hitLength(b) - hitLength(a);
    if (lenDiff !== 0) return lenDiff;
    const sevA = SEVERITY_RANK[a.severity ?? "low"];
    const sevB = SEVERITY_RANK[b.severity ?? "low"];
    return sevB - sevA;
  });

  const kept: MechanicsRuleHit[] = [];
  let lastExclusiveEnd = -1;

  for (const hit of sorted) {
    if (hit.start < lastExclusiveEnd) continue;
    kept.push(hit);
    lastExclusiveEnd = hit.end;
  }

  return kept;
}

/** Map an internal rule hit to the proofread annotation shape used by decorations + sidebar. */
export function mechanicsHitToProofreadIssue(text: string, hit: MechanicsRuleHit): ProofreadIssue | null {
  if (hit.start < 0 || hit.end > text.length || hit.start >= hit.end) return null;
  const slice = text.slice(hit.start, hit.end);
  if (!slice) return null;

  const replacement = hit.replacement?.trim();
  return {
    type: hit.category,
    text: slice,
    message: hit.message,
    ...(replacement && replacement.length > 0 ? { suggestion: replacement } : {}),
    start: hit.start,
    end: hit.end,
  };
}

/** Run all local mechanics rules against plain document text (no AI). */
export function runMechanicsProofread(text: string): ProofreadIssue[] {
  const rawHits = MECHANICS_RULES.flatMap((rule) => rule.scan(text));
  const deduped = dedupeHits(rawHits);

  const issues: ProofreadIssue[] = [];
  for (const hit of deduped) {
    const issue = mechanicsHitToProofreadIssue(text, hit);
    if (!issue) continue;
    if (issue.text !== text.slice(issue.start, issue.end)) continue;
    issues.push(issue);
  }

  return issues.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
}
