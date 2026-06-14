import type { FormatCategoryId } from "../../features/format/formatCategories";
import type { FormatCollectionResult, FormatOutputItem } from "../../features/format/formatOutputTypes";
import { extractOpenAIOutputText, getOpenAIClient, type OpenAIResponseShape } from "../openaiClient";

export const MAX_FORMAT_OUTPUT_COUNT = 100;

export async function runOpenAIFormatCollectionJob(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await getOpenAIClient().responses.create({
    model: "gpt-4o",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    text: {
      format: { type: "json_object" },
    },
  });

  const output = extractOpenAIOutputText(response as OpenAIResponseShape);
  if (!output) {
    throw new Error("OpenAI returned an empty response");
  }
  return output;
}

function readItemContent(row: Record<string, unknown>): string {
  if (typeof row.content === "string") return row.content.trim();
  if (typeof row.text === "string") return row.text.trim();
  return "";
}

const TWEETS_NOTES_ALIASES = new Set(["tweets_notes", "tweets-notes", "twitter", "x"]);

export function normalizeFormatCollectionPayload(
  raw: unknown,
  expectedCategory: FormatCategoryId,
  targetCount: number,
  itemIdPrefix: string,
  defaultTitle: string,
): FormatCollectionResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid format generation response");
  }

  const record = raw as Record<string, unknown>;
  const categoryRaw =
    typeof record.category === "string"
      ? record.category
      : typeof record.platform === "string"
        ? record.platform
        : "";
  const validCategories =
    expectedCategory === "tweets_notes"
      ? TWEETS_NOTES_ALIASES
      : new Set([expectedCategory]);

  if (!validCategories.has(categoryRaw) || record.type !== "collection") {
    throw new Error(`Unexpected format generation category (expected ${expectedCategory})`);
  }

  const itemsRaw = record.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    throw new Error("Format generation returned no outputs");
  }

  const items = itemsRaw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const content = readItemContent(row);
      if (!content) return null;
      const id =
        typeof row.id === "string" && row.id.trim()
          ? row.id.trim()
          : `${itemIdPrefix}-${index + 1}`;
      const title = typeof row.title === "string" ? row.title.trim() || null : null;
      const favorite = row.favorite === true || row.status === "favorite";
      const parsed: FormatOutputItem = {
        id,
        title,
        content,
        status: favorite ? "favorite" : "draft",
        favorite,
      };
      return parsed;
    })
    .filter((item): item is FormatOutputItem => item !== null);

  if (items.length === 0) {
    throw new Error("Format generation returned no outputs");
  }

  const count = Math.min(items.length, Math.max(1, Math.round(targetCount)));
  const trimmedItems = items.slice(0, count);

  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim()
      : defaultTitle.replace("{count}", String(trimmedItems.length));

  return {
    category: expectedCategory,
    type: "collection",
    title,
    items: trimmedItems,
  };
}
