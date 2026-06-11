import type {
  TwitterFormatGenerationItem,
  TwitterFormatGenerationResult,
} from "../features/format/formatGenerationTypes";
import { extractOpenAIOutputText, getOpenAIClient, type OpenAIResponseShape } from "./openaiClient";

/** Hard cap per request — batching for larger counts is a future improvement. */
export const MAX_TWITTER_FORMAT_COUNT = 100;

export type { TwitterFormatGenerationItem, TwitterFormatGenerationResult };

// TODO(format): add runYouTubeFormatGeneration, runSubstackFormatGeneration, etc.

export async function runTwitterFormatGeneration(
  essayText: string,
  targetCount: number,
): Promise<TwitterFormatGenerationResult> {
  const trimmedEssay = essayText.trim();
  if (!trimmedEssay) {
    throw new Error("Essay text is empty");
  }

  const count = Math.min(
    MAX_TWITTER_FORMAT_COUNT,
    Math.max(1, Math.round(targetCount)),
  );

  const response = await getOpenAIClient().responses.create({
    model: "gpt-4o",
    input: [
      {
        role: "system",
        content: `You convert essays into standalone tweets for X (Twitter).

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
- Preserve the author's voice where possible.
- Avoid hashtags unless strongly relevant.
- Avoid generic motivational filler.
- Keep each tweet concise (aim for under 280 characters).
- Use ids "tweet-1" through "tweet-${count}".
- Set status to "draft" and favorite to false for every item.
- Return JSON only. No markdown fences or explanations.`,
      },
      {
        role: "user",
        content: `Essay:\n\n${trimmedEssay}`,
      },
    ],
    text: {
      format: { type: "json_object" },
    },
  });

  const output = extractOpenAIOutputText(response as OpenAIResponseShape);
  if (!output) {
    throw new Error("OpenAI returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }

  return normalizeTwitterFormatGenerationResult(parsed, count);
}

function normalizeTwitterFormatGenerationResult(
  raw: unknown,
  targetCount: number,
): TwitterFormatGenerationResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid format generation response");
  }

  const record = raw as Record<string, unknown>;
  if (record.platform !== "twitter" || record.type !== "collection") {
    throw new Error("Unexpected format generation platform");
  }

  const itemsRaw = record.items;
  if (!Array.isArray(itemsRaw)) {
    throw new Error("Format generation response missing items");
  }

  const items: TwitterFormatGenerationItem[] = [];
  for (let index = 0; index < itemsRaw.length; index += 1) {
    const item = itemsRaw[index];
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text) continue;
    const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `tweet-${index + 1}`;
    items.push({
      id,
      text,
      status: "draft",
      favorite: false,
    });
  }

  if (items.length === 0) {
    throw new Error("Format generation returned no tweets");
  }

  const count = items.length;
  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim()
      : `Tweets — ${count} generated`;

  return {
    platform: "twitter",
    type: "collection",
    title,
    items: items.slice(0, targetCount),
  };
}
