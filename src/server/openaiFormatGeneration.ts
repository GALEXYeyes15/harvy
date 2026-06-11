import type { FormatInspirationExample } from "../features/collect/collectFormatInspiration";
import type {
  TwitterFormatGenerationItem,
  TwitterFormatGenerationResult,
} from "../features/format/formatGenerationTypes";
import {
  buildTwitterSystemPrompt,
  buildTwitterUserPrompt,
} from "../features/format/generation/twitterFormatPrompt";
import { extractOpenAIOutputText, getOpenAIClient, type OpenAIResponseShape } from "./openaiClient";

/** Hard cap per request — batching for larger counts is a future improvement. */
export const MAX_TWITTER_FORMAT_COUNT = 100;

export type { TwitterFormatGenerationItem, TwitterFormatGenerationResult };

// TODO(format): add runYouTubeFormatGeneration, runSubstackFormatGeneration, etc.

export async function runTwitterFormatGeneration(
  essayText: string,
  targetCount: number,
  inspirationExamples: FormatInspirationExample[] = [],
): Promise<TwitterFormatGenerationResult> {
  const trimmedEssay = essayText.trim();
  if (!trimmedEssay) {
    throw new Error("Essay text is empty");
  }

  const count = Math.min(
    MAX_TWITTER_FORMAT_COUNT,
    Math.max(1, Math.round(targetCount)),
  );

  const examples = inspirationExamples.filter((example) => example.preview.trim().length > 0);

  const response = await getOpenAIClient().responses.create({
    model: "gpt-4o",
    input: [
      {
        role: "system",
        content: buildTwitterSystemPrompt(count, examples.length > 0),
      },
      {
        role: "user",
        content: buildTwitterUserPrompt(trimmedEssay, examples),
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
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    throw new Error("Format generation returned no tweets");
  }

  const items = itemsRaw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const text = typeof row.text === "string" ? row.text.trim() : "";
      if (!text) return null;
      const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `tweet-${index + 1}`;
      const favorite = row.favorite === true;
      return {
        id,
        text,
        status: "draft" as const,
        favorite,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (items.length === 0) {
    throw new Error("Format generation returned no tweets");
  }

  const count = Math.min(items.length, targetCount);
  const trimmedItems = items.slice(0, count);

  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim()
      : `Tweets — ${trimmedItems.length} generated`;

  return {
    platform: "twitter",
    type: "collection",
    title,
    items: trimmedItems,
  };
}
