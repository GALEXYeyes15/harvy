export type ProofreadIssueType = "spelling" | "grammar" | "suggestion" | "ai";

export type ProofreadIssue = {
  type: ProofreadIssueType;
  text: string;
  /** Optional replacement text when the rule offers a concrete rewrite. */
  suggestion?: string;
  /** Human-readable explanation shown in the mechanics popover / sidebar. */
  message?: string;
  start: number;
  end: number;
};

export type ProofreadIssuesResponse = {
  issues: ProofreadIssue[];
};

/** Local mechanics categories (excludes on-demand AI check). */
export type MechanicsIssueType = Exclude<ProofreadIssueType, "ai">;

/** Types that open the green suggestion-style popover. */
export function isSuggestionStyleIssueType(
  type: ProofreadIssueType,
): type is "suggestion" | "ai" {
  return type === "suggestion" || type === "ai";
}
