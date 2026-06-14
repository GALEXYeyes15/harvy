export const FORMAT_CATEGORIES = [
  { id: "tweets_notes", label: "Tweets / Notes" },
  { id: "short_form_outline", label: "Short Form Outline" },
  { id: "long_form_outline", label: "Long Form Outline" },
  { id: "newsletter", label: "Newsletter" },
  { id: "podcast_notes", label: "Podcast Notes" },
] as const;

export type FormatCategoryId = (typeof FORMAT_CATEGORIES)[number]["id"];

export type FormatCategorySelection = Record<FormatCategoryId, boolean>;

export type FormatCategoryAmounts = Record<FormatCategoryId, number>;

export const FORMAT_CATEGORY_AMOUNT_DEFAULT = 100;
export const FORMAT_CATEGORY_AMOUNT_MIN = 0;
export const FORMAT_CATEGORY_AMOUNT_MAX = 100;

const LEGACY_PLATFORM_TO_CATEGORY: Record<string, FormatCategoryId> = {
  x: "tweets_notes",
  youtube: "long_form_outline",
  tiktok: "short_form_outline",
  substack: "newsletter",
  linkedin: "podcast_notes",
  instagram: "short_form_outline",
};

/** Prior category keys (kebab-case) → current snake_case keys. */
const LEGACY_CATEGORY_TO_CURRENT: Record<string, FormatCategoryId> = {
  "tweets-notes": "tweets_notes",
  "short-form-video": "short_form_outline",
  "long-form-video": "long_form_outline",
  newsletters: "newsletter",
  "podcast-ideas": "podcast_notes",
};

export function defaultFormatCategorySelection(): FormatCategorySelection {
  return {
    tweets_notes: false,
    short_form_outline: false,
    long_form_outline: false,
    newsletter: false,
    podcast_notes: false,
  };
}

export function defaultFormatCategoryAmounts(): FormatCategoryAmounts {
  return {
    tweets_notes: FORMAT_CATEGORY_AMOUNT_DEFAULT,
    short_form_outline: FORMAT_CATEGORY_AMOUNT_DEFAULT,
    long_form_outline: FORMAT_CATEGORY_AMOUNT_DEFAULT,
    newsletter: FORMAT_CATEGORY_AMOUNT_DEFAULT,
    podcast_notes: FORMAT_CATEGORY_AMOUNT_DEFAULT,
  };
}

export function hasSelectedFormatCategories(selection: FormatCategorySelection): boolean {
  return FORMAT_CATEGORIES.some((category) => selection[category.id]);
}

export function areAllFormatCategoriesSelected(selection: FormatCategorySelection): boolean {
  return FORMAT_CATEGORIES.every((category) => selection[category.id]);
}

export function allFormatCategoriesSelected(): FormatCategorySelection {
  return Object.fromEntries(
    FORMAT_CATEGORIES.map((category) => [category.id, true]),
  ) as FormatCategorySelection;
}

function resolveLegacyCategoryKey(key: string): FormatCategoryId | null {
  if (key in LEGACY_CATEGORY_TO_CURRENT) {
    return LEGACY_CATEGORY_TO_CURRENT[key] as FormatCategoryId;
  }
  if (key in LEGACY_PLATFORM_TO_CATEGORY) {
    return LEGACY_PLATFORM_TO_CATEGORY[key] as FormatCategoryId;
  }
  return null;
}

/** Migrate legacy platform or prior category keys to current category keys. */
export function normalizeFormatCategorySelection(
  value: Partial<Record<string, boolean>> | undefined,
): FormatCategorySelection {
  if (!value) return defaultFormatCategorySelection();
  if ("tweets_notes" in value) {
    return { ...defaultFormatCategorySelection(), ...(value as FormatCategorySelection) };
  }

  const normalized = defaultFormatCategorySelection();
  for (const [legacyKey, enabled] of Object.entries(value)) {
    if (!enabled) continue;
    const categoryId = resolveLegacyCategoryKey(legacyKey);
    if (categoryId) normalized[categoryId] = true;
  }
  return normalized;
}

export function normalizeFormatCategoryAmounts(
  value: Partial<Record<string, number>> | undefined,
): FormatCategoryAmounts {
  if (!value) return defaultFormatCategoryAmounts();
  if ("tweets_notes" in value) {
    return { ...defaultFormatCategoryAmounts(), ...(value as FormatCategoryAmounts) };
  }

  const normalized = defaultFormatCategoryAmounts();
  for (const [legacyKey, amount] of Object.entries(value)) {
    if (typeof amount !== "number") continue;
    const categoryId = resolveLegacyCategoryKey(legacyKey);
    if (categoryId) normalized[categoryId] = amount;
  }
  return normalized;
}
