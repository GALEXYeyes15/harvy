import type { FormatCategoryId } from "../format/formatCategories";
import type { CollectItem, CollectItemType } from "./collectItems";

export const COLLECT_INSPIRATION_MAX = 25;

export type FormatInspirationExample = {
  preview: string;
  format: string;
  type: CollectItemType;
};

function formatMatches(itemFormat: string, targetFormat: string): boolean {
  return itemFormat.trim().toLowerCase() === targetFormat.trim().toLowerCase();
}

function inspirationSortScore(type: CollectItemType): number {
  return type === "Craft" ? 0 : 1;
}

/** Collect Format values used for style inspiration per Harvy output category. */
export function collectFormatsForCategory(category: FormatCategoryId): string[] {
  switch (category) {
    case "tweets_notes":
      return ["Tweet", "Note", "Notes"];
    case "short_form_outline":
      return ["Short Form", "TikTok", "Reel", "Video"];
    case "long_form_outline":
      return ["YouTube", "Video", "Long Form"];
    case "newsletter":
      return ["Newsletter", "Substack", "Email"];
    case "podcast_notes":
      return ["Podcast", "Interview"];
    default:
      return [];
  }
}

/**
 * Select Collect items as format/style inspiration for generation.
 * Prefers Type = Craft, then most recently created. Caps at COLLECT_INSPIRATION_MAX.
 */
export function selectCollectInspirationExamples(
  items: CollectItem[],
  targetFormats: string[],
): FormatInspirationExample[] {
  const matching = items.filter(
    (item) =>
      targetFormats.some((format) => formatMatches(item.format, format)) &&
      item.preview.trim().length > 0,
  );

  const sorted = [...matching].sort((a, b) => {
    const typeDiff = inspirationSortScore(a.type) - inspirationSortScore(b.type);
    if (typeDiff !== 0) return typeDiff;
    return b.dateCreated.localeCompare(a.dateCreated);
  });

  return sorted.slice(0, COLLECT_INSPIRATION_MAX).map((item) => ({
    preview: item.preview.trim(),
    format: item.format,
    type: item.type,
  }));
}

export function collectInspirationExamplesForCategory(
  items: CollectItem[],
  category: FormatCategoryId,
): FormatInspirationExample[] {
  const targetFormats = collectFormatsForCategory(category);
  if (targetFormats.length === 0) return [];
  return selectCollectInspirationExamples(items, targetFormats);
}
