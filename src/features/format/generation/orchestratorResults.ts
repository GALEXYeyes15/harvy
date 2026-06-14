import type { FormatCollectionResult } from "../formatOutputTypes";
import type {
  FormatCategoryGenerationSuccess,
  FormatGenerationOrchestratorResult,
} from "./orchestratorTypes";

export function isFormatCategorySuccess(
  result: FormatGenerationOrchestratorResult[keyof FormatGenerationOrchestratorResult],
): result is FormatCategoryGenerationSuccess {
  return Boolean(result && result.status === "success");
}

export function orchestratorErrors(result: FormatGenerationOrchestratorResult): string[] {
  return Object.values(result)
    .filter((entry) => entry?.status === "error")
    .map((entry) => (entry?.status === "error" ? entry.error : ""))
    .filter(Boolean);
}

export function orchestratorSuccessCount(result: FormatGenerationOrchestratorResult): number {
  return Object.values(result).filter(isFormatCategorySuccess).length;
}

export function tweetsNotesCollectionFromOrchestrator(
  result: FormatGenerationOrchestratorResult,
): FormatCollectionResult | null {
  const tweetsResult = result.tweets_notes;
  if (!isFormatCategorySuccess(tweetsResult)) return null;
  return {
    category: "tweets_notes",
    type: "collection",
    title: tweetsResult.title,
    items: tweetsResult.outputs,
  };
}

export function formatOrchestratorSummary(result: FormatGenerationOrchestratorResult): string | null {
  const errors = orchestratorErrors(result);
  const successes = orchestratorSuccessCount(result);
  if (errors.length === 0) return null;
  if (successes === 0) {
    return errors[0] ?? "Format generation failed";
  }
  return `Generated ${successes} format${successes === 1 ? "" : "s"}; ${errors.length} failed.`;
}
