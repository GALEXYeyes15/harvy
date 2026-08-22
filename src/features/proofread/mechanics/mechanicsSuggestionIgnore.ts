import { getSpellingDocumentKey } from "./spellingDictionary";
import type { ProofreadIssue } from "../types";

/** Per-document ignored mechanics suggestion spans (session only). */
const ignoredByDocument = new Map<string, Set<string>>();

function suggestionIgnoreKey(issue: Pick<ProofreadIssue, "start" | "end" | "text" | "message">): string {
  return `${issue.start}:${issue.end}:${issue.text}:${issue.message ?? ""}`;
}

function ignoredForDocument(documentKey: string): Set<string> {
  let set = ignoredByDocument.get(documentKey);
  if (!set) {
    set = new Set();
    ignoredByDocument.set(documentKey, set);
  }
  return set;
}

export function ignoreMechanicsSuggestionForDocument(
  issue: Pick<ProofreadIssue, "start" | "end" | "text" | "message">,
  documentKey?: string,
): void {
  const key = documentKey ?? getSpellingDocumentKey();
  ignoredForDocument(key).add(suggestionIgnoreKey(issue));
}

export function isMechanicsSuggestionIgnored(
  issue: Pick<ProofreadIssue, "start" | "end" | "text" | "message">,
  documentKey?: string,
): boolean {
  const key = documentKey ?? getSpellingDocumentKey();
  return ignoredForDocument(key).has(suggestionIgnoreKey(issue));
}

export function filterIgnoredMechanicsSuggestions(
  issues: ProofreadIssue[],
  documentKey?: string,
): ProofreadIssue[] {
  const docKey = documentKey ?? getSpellingDocumentKey();
  return issues.filter((issue) => {
    if (issue.type !== "suggestion" && issue.type !== "ai") return true;
    return !isMechanicsSuggestionIgnored(issue, docKey);
  });
}
