import type { FormatCategoryId } from "../formatCategories";
import type { FormatCollectionResult, FormatOutputItem } from "../formatOutputTypes";

const TWEETS_NOTES_ALIASES = new Set(["tweets_notes", "tweets-notes", "twitter", "x"]);

function readItemContent(row: Record<string, unknown>): string {
  if (typeof row.content === "string") return row.content.trim();
  if (typeof row.text === "string") return row.text.trim();
  return "";
}

function parseItem(row: unknown, index: number, idPrefix: string): FormatOutputItem | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const content = readItemContent(record);
  if (!content) return null;

  const id =
    typeof record.id === "string" && record.id.trim()
      ? record.id.trim()
      : `${idPrefix}-${index + 1}`;
  const title = typeof record.title === "string" ? record.title.trim() || null : null;
  const favorite = record.favorite === true || record.status === "favorite";
  const status =
    record.status === "edited" || record.status === "published" || record.status === "favorite"
      ? record.status
      : favorite
        ? "favorite"
        : "draft";

  return { id, title, content, status, favorite };
}

function resolveCategory(record: Record<string, unknown>): FormatCategoryId | null {
  const category = record.category;
  if (typeof category === "string") {
    if (TWEETS_NOTES_ALIASES.has(category)) return "tweets_notes";
    if (
      category === "mid_form_post" ||
      category === "short_form_outline" ||
      category === "long_form_outline" ||
      category === "newsletter" ||
      category === "podcast_notes"
    ) {
      return category;
    }
  }

  const platform = record.platform;
  if (typeof platform === "string" && TWEETS_NOTES_ALIASES.has(platform)) {
    return "tweets_notes";
  }

  return null;
}

export function parseFormatCollectionResult(
  raw: unknown,
  expectedCategory: FormatCategoryId = "tweets_notes",
): FormatCollectionResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid format generation response");
  }

  const record = raw as Record<string, unknown>;
  if (record.type !== "collection") {
    throw new Error("Unexpected format generation response");
  }

  const category = resolveCategory(record) ?? expectedCategory;

  const itemsRaw = record.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    throw new Error("Format generation returned no outputs");
  }

  const idPrefix = category === "tweets_notes" ? "tweets-notes" : category.replace(/_/g, "-");
  const items = itemsRaw
    .map((item, index) => parseItem(item, index, idPrefix))
    .filter((item): item is FormatOutputItem => item !== null);

  if (items.length === 0) {
    throw new Error("Format generation returned no outputs");
  }

  const defaultTitle =
    category === "tweets_notes"
      ? `Tweets / Notes — ${items.length} generated`
      : `${category} — ${items.length} generated`;

  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim()
      : defaultTitle;

  return { category, type: "collection", title, items };
}
