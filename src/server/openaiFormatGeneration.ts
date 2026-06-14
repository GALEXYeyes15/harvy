import type { FormatInspirationExample } from "../features/collect/collectFormatInspiration";
import type { FormatCollectionResult } from "../features/format/formatOutputTypes";
import { runFormatCategoryJob } from "./formatGeneration/categoryJobs";
import { MAX_FORMAT_OUTPUT_COUNT } from "./formatGeneration/shared";

/** @deprecated Use MAX_FORMAT_OUTPUT_COUNT — kept for compatibility. */
export const MAX_TWITTER_FORMAT_COUNT = MAX_FORMAT_OUTPUT_COUNT;

/** Legacy single-category Tweets / Notes job — prefer `generateFormatOutputs` orchestrator. */
export async function runTweetsNotesFormatGeneration(
  essayText: string,
  targetCount: number,
  inspirationExamples: FormatInspirationExample[] = [],
): Promise<FormatCollectionResult> {
  return runFormatCategoryJob("tweets_notes", essayText, targetCount, inspirationExamples);
}

/** @deprecated Use runTweetsNotesFormatGeneration */
export const runTwitterFormatGeneration = runTweetsNotesFormatGeneration;
