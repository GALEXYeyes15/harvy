import type { FormatCollectionResult, FormatOutputItem } from "./formatOutputTypes";

/** @deprecated Use FormatOutputItem */
export type TwitterFormatGenerationItem = {
  id: string;
  text: string;
  status: FormatOutputItem["status"];
  favorite: boolean;
};

/** @deprecated Use FormatCollectionResult */
export type TwitterFormatGenerationResult = {
  platform: "twitter";
  type: "collection";
  title: string;
  items: TwitterFormatGenerationItem[];
};

export function legacyTwitterResultFromCollection(
  collection: FormatCollectionResult,
): TwitterFormatGenerationResult {
  return {
    platform: "twitter",
    type: "collection",
    title: collection.title,
    items: collection.items.map((item) => ({
      id: item.id,
      text: item.content,
      status: item.status,
      favorite: item.favorite,
    })),
  };
}
