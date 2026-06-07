export type ProofreadIssueType = "spelling" | "grammar" | "suggestion";

export type ProofreadIssue = {
  type: ProofreadIssueType;
  text: string;
  suggestion?: string;
  start: number;
  end: number;
};

export type ProofreadIssuesResponse = {
  issues: ProofreadIssue[];
};
