import type { FormatInspirationExample } from "../../features/collect/collectFormatInspiration";
import type { FormatCategoryId } from "../../features/format/formatCategories";
import type { FormatCollectionResult } from "../../features/format/formatOutputTypes";
import {
  buildMidFormPostSystemPrompt,
  buildMidFormPostUserPrompt,
} from "../../features/format/generation/prompts/midFormPostFormatPrompt";
import {
  buildTweetsNotesSystemPrompt,
  buildTweetsNotesUserPrompt,
} from "../../features/format/generation/prompts/tweetsNotesFormatPrompt";
import {
  MAX_FORMAT_OUTPUT_COUNT,
  normalizeFormatCollectionPayload,
  parseFormatCollectionModelJson,
  runOpenAIFormatCollectionJob,
} from "./shared";

type FormatCategoryJobConfig = {
  itemIdPrefix: string;
  defaultTitle: string;
  buildSystemPrompt: (count: number, hasInspirationExamples: boolean) => string;
  buildUserPrompt: (essayText: string, inspirationExamples: FormatInspirationExample[]) => string;
};

const IMPLEMENTED_CATEGORY_JOBS: Partial<Record<FormatCategoryId, FormatCategoryJobConfig>> = {
  tweets_notes: {
    itemIdPrefix: "tweets-notes",
    defaultTitle: "Tweets / Notes — {count} generated",
    buildSystemPrompt: buildTweetsNotesSystemPrompt,
    buildUserPrompt: buildTweetsNotesUserPrompt,
  },
  mid_form_post: {
    itemIdPrefix: "mid-form-post",
    defaultTitle: "Mid Form Post — {count} generated",
    buildSystemPrompt: buildMidFormPostSystemPrompt,
    buildUserPrompt: buildMidFormPostUserPrompt,
  },
};

export async function runFormatCategoryJob(
  category: FormatCategoryId,
  essayText: string,
  targetCount: number,
  inspirationExamples: FormatInspirationExample[] = [],
): Promise<FormatCollectionResult> {
  const trimmedEssay = essayText.trim();
  if (!trimmedEssay) {
    throw new Error("Essay text is empty");
  }

  const jobConfig = IMPLEMENTED_CATEGORY_JOBS[category];
  if (!jobConfig) {
    switch (category) {
      case "short_form_outline":
        // TODO(format): generate_short_form_outline_formats
        throw new Error("Short Form Outline generation is not yet implemented");
      case "long_form_outline":
        // TODO(format): generate_long_form_outline_formats
        throw new Error("Long Form Outline generation is not yet implemented");
      case "newsletter":
        // TODO(format): generate_newsletter_formats
        throw new Error("Newsletter generation is not yet implemented");
      case "podcast_notes":
        // TODO(format): generate_podcast_notes_formats
        throw new Error("Podcast Notes generation is not yet implemented");
      default:
        throw new Error("Unknown format category");
    }
  }

  const count = Math.min(MAX_FORMAT_OUTPUT_COUNT, Math.max(1, Math.round(targetCount)));
  const examples = inspirationExamples.filter((example) => example.preview.trim().length > 0);

  const output = await runOpenAIFormatCollectionJob(
    jobConfig.buildSystemPrompt(count, examples.length > 0),
    jobConfig.buildUserPrompt(trimmedEssay, examples),
  );

  if (import.meta.env.DEV) {
    console.log("RAW ANTHROPIC MODEL TEXT", output);
  }

  const parsed = parseFormatCollectionModelJson(output);

  return normalizeFormatCollectionPayload(
    parsed,
    category,
    count,
    jobConfig.itemIdPrefix,
    jobConfig.defaultTitle,
  );
}
