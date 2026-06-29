export type ProofreadIssueType = "spelling" | "grammar" | "suggestion";

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
