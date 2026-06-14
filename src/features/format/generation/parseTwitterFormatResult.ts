import type { TwitterFormatGenerationResult } from "../formatGenerationTypes";
import { legacyTwitterResultFromCollection } from "../formatGenerationTypes";
import { parseFormatCollectionResult } from "./parseFormatCollectionResult";

/** @deprecated Use parseFormatCollectionResult */
export function parseTwitterFormatGenerationResult(raw: unknown): TwitterFormatGenerationResult {
  return legacyTwitterResultFromCollection(parseFormatCollectionResult(raw, "tweets_notes"));
}
