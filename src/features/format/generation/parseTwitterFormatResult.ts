import type { TwitterFormatGenerationResult } from "../formatGenerationTypes";

export function parseTwitterFormatGenerationResult(raw: unknown): TwitterFormatGenerationResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid format generation response");
  }

  const record = raw as Record<string, unknown>;
  if (record.platform !== "twitter" || record.type !== "collection") {
    throw new Error("Unexpected format generation response");
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
      const favorite = row.favorite === true || row.status === "favorite";
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

  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim()
      : `Tweets — ${items.length} generated`;

  return {
    platform: "twitter",
    type: "collection",
    title,
    items: items.map((item) => ({
      id: item.id,
      text: item.text,
      status: "draft" as const,
      favorite: item.favorite,
    })),
  };
}
