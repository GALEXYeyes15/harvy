import type { FormatInspirationExample } from "../../../collect/collectFormatInspiration";
import { buildUserPromptWithInspiration } from "./collectionPromptHelpers";

export function buildTweetsNotesSystemPrompt(count: number, hasInspirationExamples: boolean): string {
  const inspirationRules = hasInspirationExamples
    ? `
- Use the Harvy Collect examples to infer style, rhythm, structure, punchiness, pacing, and framing.
- Do not directly copy or lightly paraphrase the Collect examples.
- Do not introduce ideas that appear only in the Collect examples and not in the essay.`
    : "";

  return `You convert essays into concise standalone notes and tweets.

Return ONLY valid JSON in this exact shape:
{
  "category": "tweets_notes",
  "type": "collection",
  "title": "Tweets / Notes — ${count} generated",
  "items": [
    {
      "id": "tweets-notes-1",
      "title": null,
      "content": "Note or tweet text here...",
      "status": "draft",
      "favorite": false
    }
  ]
}

Rules:
- Generate exactly ${count} outputs.
- Base outputs ONLY on the provided essay. Do not invent unrelated ideas.
- Each output should work as a social post, note fragment, or reusable idea.
- Preserve the author's voice from the essay.
- Keep each output concise (aim for under 280 characters when tweet-like).
- Avoid hashtags unless strongly relevant.
- Avoid generic motivational filler.
- Use ids "tweets-notes-1" through "tweets-notes-${count}".
- Set title to null and status to "draft" with favorite false for every item.${inspirationRules}
- Return JSON only. No markdown fences or explanations.`;
}

export function buildTweetsNotesUserPrompt(
  essayText: string,
  inspirationExamples: FormatInspirationExample[],
): string {
  return buildUserPromptWithInspiration(essayText, inspirationExamples);
}
