import type { FormatInspirationExample } from "../../../collect/collectFormatInspiration";
import { buildCollectionSystemPrompt, buildUserPromptWithInspiration } from "./collectionPromptHelpers";

// TODO(format): Wire into generate_podcast_notes_formats when implemented.
export function buildPodcastNotesSystemPrompt(count: number, hasInspirationExamples: boolean): string {
  return buildCollectionSystemPrompt({
    category: "podcast_notes",
    roleDescription:
      "You convert essays into podcast-ready notes for conversation planning. This is not a full transcript.",
    count,
    itemIdPrefix: "podcast-notes",
    titleExample: `Podcast Notes — ${count} generated`,
    hasInspirationExamples,
    outputRules: `
- Each output must include: Episode idea, Main questions, Talking points, and possible guest/audience prompts if relevant.
- Format each output with clear labeled sections.
- Keep outputs essay-driven and conversational in tone.`,
  });
}

export function buildPodcastNotesUserPrompt(
  essayText: string,
  inspirationExamples: FormatInspirationExample[],
): string {
  return buildUserPromptWithInspiration(essayText, inspirationExamples);
}
