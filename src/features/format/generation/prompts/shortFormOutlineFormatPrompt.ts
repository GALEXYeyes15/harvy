import type { FormatInspirationExample } from "../../../collect/collectFormatInspiration";
import { buildCollectionSystemPrompt, buildUserPromptWithInspiration } from "./collectionPromptHelpers";

// TODO(format): Wire into generate_short_form_outline_formats when implemented.
export function buildShortFormOutlineSystemPrompt(count: number, hasInspirationExamples: boolean): string {
  return buildCollectionSystemPrompt({
    category: "short_form_outline",
    roleDescription:
      "You convert essays into short-form video outlines designed for vertical short video (Shorts, Reels, TikTok-style). Do not name specific platforms unless useful.",
    count,
    itemIdPrefix: "short-form-outline",
    titleExample: `Short Form Outline — ${count} generated`,
    hasInspirationExamples,
    outputRules: `
- Each output must include: Hook, Setup, Key idea, Payoff, and an optional CTA.
- Format each output with clear labeled sections.
- Keep language spoken and punchy.
- One distinct outline per output.`,
  });
}

export function buildShortFormOutlineUserPrompt(
  essayText: string,
  inspirationExamples: FormatInspirationExample[],
): string {
  return buildUserPromptWithInspiration(essayText, inspirationExamples);
}
