import type { FormatInspirationExample } from "../../../collect/collectFormatInspiration";
import { buildCollectionSystemPrompt, buildUserPromptWithInspiration } from "./collectionPromptHelpers";

// TODO(format): Wire into generate_long_form_outline_formats when implemented.
export function buildLongFormOutlineSystemPrompt(count: number, hasInspirationExamples: boolean): string {
  return buildCollectionSystemPrompt({
    category: "long_form_outline",
    roleDescription: "You convert essays into long-form video outlines. This is an outline, not a full script.",
    count,
    itemIdPrefix: "long-form-outline",
    titleExample: `Long Form Outline — ${count} generated`,
    hasInspirationExamples,
    outputRules: `
- Each output must include: Title idea, Opening hook, Main sections, Key talking points, and Closing idea.
- Format each output with clear labeled sections.
- Favor spoken, conversational structure suitable for long-form video.
- Do not write a full word-for-word script.`,
  });
}

export function buildLongFormOutlineUserPrompt(
  essayText: string,
  inspirationExamples: FormatInspirationExample[],
): string {
  return buildUserPromptWithInspiration(essayText, inspirationExamples);
}
