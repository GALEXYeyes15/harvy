import type { FormatPlatformId } from "../format/formatPlatforms";
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

/** Collect Format value used for style inspiration per Harvy Format platform. */
export function collectFormatForPlatform(platform: FormatPlatformId): string | null {
  switch (platform) {
    case "x":
      return "Tweet";
    // TODO(format): YouTube generation — use Collect items where Format = YouTube
    case "youtube":
      return "Video";
    // TODO(format): Substack generation — use Collect items where Format = Newsletter/Substack
    case "substack":
      return "Article";
    // TODO(format): Instagram generation — use Collect items where Format = Instagram
    case "instagram":
      return "Quote";
    // TODO(format): TikTok generation — use Collect items where Format = Short Form/TikTok
    case "tiktok":
      return "Thread";
    // TODO(format): LinkedIn generation — use Collect items where Format = LinkedIn
    case "linkedin":
      return "Article";
    default:
      return null;
  }
}

/**
 * Select Collect items as format/style inspiration for generation.
 * Prefers Type = Craft, then most recently created. Caps at COLLECT_INSPIRATION_MAX.
 */
export function selectCollectInspirationExamples(
  items: CollectItem[],
  targetFormat: string,
): FormatInspirationExample[] {
  const matching = items.filter(
    (item) => formatMatches(item.format, targetFormat) && item.preview.trim().length > 0,
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

export function collectInspirationExamplesForPlatform(
  items: CollectItem[],
  platform: FormatPlatformId,
): FormatInspirationExample[] {
  const targetFormat = collectFormatForPlatform(platform);
  if (!targetFormat) return [];
  return selectCollectInspirationExamples(items, targetFormat);
}
