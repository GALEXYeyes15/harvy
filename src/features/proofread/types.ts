export type ProofreadIssueType = "spelling" | "grammar" | "suggestion" | "ai" | "related";

export type ProofreadIssue = {
  type: ProofreadIssueType;
  text: string;
  /** Optional replacement text when the rule offers a concrete rewrite. */
  suggestion?: string;
  /** Human-readable explanation shown in the mechanics popover / sidebar. */
  message?: string;
  start: number;
  end: number;
  /** Workspace path of the related essay, when `type` is `"related"`. */
  relatedPath?: string;
  /** Public or Notion URL for Link Essay, when `type` is `"related"`. */
  relatedUrl?: string;
  /** Related essay title shown in the popover. */
  relatedTitle?: string;
};

export type ProofreadIssuesResponse = {
  issues: ProofreadIssue[];
};

/** Local mechanics categories (excludes on-demand AI / related-essay checks). */
export type MechanicsIssueType = Exclude<ProofreadIssueType, "ai" | "related">;

/** Solid cyan bar — AI check and related-essay phrases. */
export function isCyanUnderlineType(type: ProofreadIssueType): type is "ai" | "related" {
  return type === "ai" || type === "related";
}

/** Types that open the suggestion-style popover. */
export function isSuggestionStyleIssueType(
  type: ProofreadIssueType,
): type is "suggestion" | "ai" | "related" {
  return type === "suggestion" || type === "ai" || type === "related";
}
