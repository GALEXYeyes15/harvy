import type { FormatInspirationExample } from "../../../collect/collectFormatInspiration";
import { buildCollectionSystemPrompt, buildUserPromptWithInspiration } from "./collectionPromptHelpers";

// TODO(format): Wire into generate_newsletter_formats when implemented.
export function buildNewsletterSystemPrompt(count: number, hasInspirationExamples: boolean): string {
  return buildCollectionSystemPrompt({
    category: "newsletter",
    roleDescription: "You convert essays into newsletter drafts or newsletter outlines.",
    count,
    itemIdPrefix: "newsletter",
    titleExample: `Newsletter — ${count} generated`,
    hasInspirationExamples,
    outputRules: `
- Each output must include: Subject/title idea, Opening, Main body, and Closing.
- Keep outputs essay-driven; preserve the author's voice and key arguments.
- Favor readable paragraphs over tweet-style fragments.
- Avoid clickbait framing.`,
  });
}

export function buildNewsletterUserPrompt(
  essayText: string,
  inspirationExamples: FormatInspirationExample[],
): string {
  return buildUserPromptWithInspiration(essayText, inspirationExamples);
}
