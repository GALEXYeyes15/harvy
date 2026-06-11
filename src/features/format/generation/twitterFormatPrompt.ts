import type { FormatInspirationExample } from "../../collect/collectFormatInspiration";

const INSPIRATION_PREAMBLE = `Below are examples of tweet formats the user has saved in Harvy Collect. Use these as inspiration for structure and style only. Do not copy them. Do not reuse their specific claims unless those claims also appear in the essay. The generated tweets should be about the essay, but shaped by the patterns in these examples.`;

export function buildTwitterSystemPrompt(count: number, hasInspirationExamples: boolean): string {
  const inspirationRules = hasInspirationExamples
    ? `
- Use the Harvy Collect examples to infer style, rhythm, structure, punchiness, pacing, and framing.
- Do not directly copy or lightly paraphrase the Collect examples.
- Do not introduce ideas that appear only in the Collect examples and not in the essay.`
    : "";

  return `You convert essays into standalone tweets for X (Twitter).

Return ONLY valid JSON in this exact shape:
{
  "platform": "twitter",
  "type": "collection",
  "title": "Tweets — ${count} generated",
  "items": [
    {
      "id": "tweet-1",
      "text": "Tweet text here...",
      "status": "draft",
      "favorite": false
    }
  ]
}

Rules:
- Generate exactly ${count} tweets.
- Base tweets ONLY on the provided essay. Do not invent unrelated ideas.
- Each tweet must stand alone and make sense without the essay.
- Preserve the author's voice from the essay.
- Avoid hashtags unless strongly relevant.
- Avoid generic motivational filler.
- Keep each tweet concise (aim for under 280 characters).
- Use ids "tweet-1" through "tweet-${count}".
- Set status to "draft" and favorite to false for every item.${inspirationRules}
- Return JSON only. No markdown fences or explanations.`;
}

export function buildTwitterUserPrompt(
  essayText: string,
  inspirationExamples: FormatInspirationExample[],
): string {
  const trimmedEssay = essayText.trim();
  if (inspirationExamples.length === 0) {
    return `Essay:\n\n${trimmedEssay}`;
  }

  const examplesBlock = inspirationExamples
    .map((example, index) => `${index + 1}. [${example.type}] ${example.preview}`)
    .join("\n");

  return `Essay:\n\n${trimmedEssay}\n\n${INSPIRATION_PREAMBLE}\n\n${examplesBlock}`;
}
