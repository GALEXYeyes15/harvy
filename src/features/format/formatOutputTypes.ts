import type { FormatCategoryId } from "./formatCategories";

export type FormatOutputStatus = "draft" | "edited" | "favorite" | "published";

export type FormatOutputItem = {
  id: string;
  title: string | null;
  content: string;
  status: FormatOutputStatus;
  favorite: boolean;
};

export type FormatCollectionResult = {
  category: FormatCategoryId;
  type: "collection";
  title: string;
  items: FormatOutputItem[];
};

export type FormatSingleResult = {
  category: FormatCategoryId;
  type: "single";
  title: string;
  content: string;
  status: FormatOutputStatus;
  favorite: boolean;
};

/** @deprecated Use FormatCollectionResult — kept for legacy persistence migration. */
export type LegacyTwitterFormatGenerationResult = {
  platform: "twitter";
  type: "collection";
  title: string;
  items: Array<{
    id: string;
    text: string;
    status: FormatOutputStatus;
    favorite: boolean;
  }>;
};
