import type { FormatInspirationExample } from "../../features/collect/collectFormatInspiration";
import type { FormatCategoryId } from "../../features/format/formatCategories";
import type { FormatCollectionResult } from "../../features/format/formatOutputTypes";
import {
  buildTweetsNotesSystemPrompt,
  buildTweetsNotesUserPrompt,
} from "../../features/format/generation/prompts/tweetsNotesFormatPrompt";
import {
  MAX_FORMAT_OUTPUT_COUNT,
  normalizeFormatCollectionPayload,
  runOpenAIFormatCollectionJob,
} from "./shared";

const TWEETS_NOTES_JOB = {
  itemIdPrefix: "tweets-notes",
  defaultTitle: "Tweets / Notes — {count} generated",
  buildSystemPrompt: buildTweetsNotesSystemPrompt,
  buildUserPrompt: buildTweetsNotesUserPrompt,
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

  if (category !== "tweets_notes") {
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
    TWEETS_NOTES_JOB.buildSystemPrompt(count, examples.length > 0),
    TWEETS_NOTES_JOB.buildUserPrompt(trimmedEssay, examples),
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  return normalizeFormatCollectionPayload(
    parsed,
    "tweets_notes",
    count,
    TWEETS_NOTES_JOB.itemIdPrefix,
    TWEETS_NOTES_JOB.defaultTitle,
  );
}
