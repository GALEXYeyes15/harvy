import type { ProofreadIssueType } from "../types";

/** Category for a local mechanics rule hit (maps 1:1 to `ProofreadIssueType`). */
export type MechanicsRuleCategory = ProofreadIssueType;

/**
 * Result from a single rule. Offsets are UTF-16 indices into the full document plain text
 * (same coordinate system as `proofreadPlainTextAndPositions`).
 */
export type MechanicsRuleHit = {
  category: MechanicsRuleCategory;
  /** Human-readable explanation shown when no replacement is available. */
  message: string;
  /** Preferred fix text, if the rule can suggest one. */
  replacement?: string;
  start: number;
  end: number;
  /** Optional weight for overlap resolution (higher wins). Not surfaced in UI today. */
  severity?: "low" | "medium" | "high";
};

/**
 * A document-level mechanics rule. Add new rules by implementing `scan` and registering
 * the rule in `mechanicsEngine.ts`.
 */
export type MechanicsRule = {
  id: string;
  category: MechanicsRuleCategory;
  scan: (text: string) => MechanicsRuleHit[];
};
