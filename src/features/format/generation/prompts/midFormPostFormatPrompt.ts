import type { FormatInspirationExample } from "../../../collect/collectFormatInspiration";
import { buildCollectionSystemPrompt, buildUserPromptWithInspiration } from "./collectionPromptHelpers";

const MID_FORM_POST_OUTPUT_RULES = `
- Each output should focus on a single idea, lesson, story, or insight from the essay.
- Aim for 150–250 words per output.
- You are not rewriting the author's voice. You are compressing the author's voice.
- Create a 150–250 word excerpt that could plausibly have appeared inside the original essay.
- A reader familiar with the original essay should feel that the same person wrote both pieces.
- The post should read as a condensed version of the source, not a social-media-optimized rewrite.

VOICE PRESERVATION:
- Match sentence length patterns from the source (long paragraphs if the source uses them; short sentences if the source uses them).
- Match punctuation style. Do not introduce em dashes, semicolons, excessive colons, or other punctuation habits absent from the source.
- Match pacing and rhythm. Do not turn reflective writing into motivational writing.
- Match tone: analytical stays analytical; story-driven stays story-driven; technical stays technical; personal stays personal.
- Preserve the author's vocabulary whenever possible.
- Preserve the author's level of certainty. Do not make claims stronger than the source or add urgency or emotional intensity.

AVOID unless already present in the source:
- Generic social media patterns ("Here's what I learned", "The lesson is...", "If you've ever...", "This changed everything", "Most people don't realize...", and similar engagement clichés).
- Hook-heavy openings, motivational phrasing, generic audience callouts, or punchier cadence than the original author.
- Hashtags unless the essay explicitly requests them.`;

export function buildMidFormPostSystemPrompt(count: number, hasInspirationExamples: boolean): string {
  const inspirationNote = hasInspirationExamples
    ? `
- Collect examples may inform structure only when consistent with the essay's voice. The essay's style always takes priority over Collect examples.`
    : "";

  return buildCollectionSystemPrompt({
    category: "mid_form_post",
    roleDescription:
      "You compress essays into mid-form posts (150–250 words) suitable for LinkedIn, Instagram captions, Threads, Facebook, and similar platforms — without changing how the author sounds.",
    count,
    itemIdPrefix: "mid-form-post",
    titleExample: `Mid Form Post — ${count} generated`,
    hasInspirationExamples: false,
    outputRules: `${MID_FORM_POST_OUTPUT_RULES}${inspirationNote}`,
  });
}

export function buildMidFormPostUserPrompt(
  essayText: string,
  inspirationExamples: FormatInspirationExample[],
): string {
  return buildUserPromptWithInspiration(essayText, inspirationExamples);
}
