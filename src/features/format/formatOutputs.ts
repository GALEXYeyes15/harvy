/** Minimum items in a category before it collapses into one collection card. */
export const FORMAT_COLLECTION_THRESHOLD = 5;

export type FormatOutputItem = {
  id: string;
  title: string;
  subtitle?: string;
};

export type FormatCategoryGroup = {
  category: string;
  items: FormatOutputItem[];
};

export type FormatGalleryCard =
  | {
      kind: "individual";
      id: string;
      category: string;
      title: string;
      subtitle?: string;
    }
  | {
      kind: "collection";
      id: string;
      category: string;
      title: string;
      count: number;
    };

/** Placeholder outputs — no generation yet. */
export const PLACEHOLDER_FORMAT_GROUPS: FormatCategoryGroup[] = [
  {
    category: "Tweets",
    items: Array.from({ length: 50 }, (_, index) => ({
      id: `tweet-${index + 1}`,
      title: `Tweet ${index + 1}`,
      subtitle: "Social post",
    })),
  },
  {
    category: "YouTube scripts",
    items: [
      { id: "yt-1", title: "Opening hook", subtitle: "YouTube script" },
      { id: "yt-2", title: "Product walkthrough", subtitle: "YouTube script" },
      { id: "yt-3", title: "Outro CTA", subtitle: "YouTube script" },
    ],
  },
  {
    category: "Newsletter",
    items: [
      { id: "nl-1", title: "Weekly digest", subtitle: "Newsletter" },
      { id: "nl-2", title: "Launch announcement", subtitle: "Newsletter" },
    ],
  },
  {
    category: "LinkedIn posts",
    items: [
      { id: "li-1", title: "Founder story", subtitle: "LinkedIn post" },
      { id: "li-2", title: "Product update", subtitle: "LinkedIn post" },
      { id: "li-3", title: "Hiring note", subtitle: "LinkedIn post" },
      { id: "li-4", title: "Customer win", subtitle: "LinkedIn post" },
    ],
  },
  {
    category: "Short form scripts",
    items: [
      { id: "sf-1", title: "Hook + payoff", subtitle: "Short-form script" },
      { id: "sf-2", title: "Product demo", subtitle: "Short-form script" },
      { id: "sf-3", title: "Behind the scenes", subtitle: "Short-form script" },
    ],
  },
];

/** Categories with 5+ items become one collection card; fewer render as individual cards. */
export function buildFormatGalleryCards(groups: FormatCategoryGroup[]): FormatGalleryCard[] {
  const cards: FormatGalleryCard[] = [];

  for (const group of groups) {
    if (group.items.length >= FORMAT_COLLECTION_THRESHOLD) {
      cards.push({
        kind: "collection",
        id: `collection-${group.category}`,
        category: group.category,
        title: group.category,
        count: group.items.length,
      });
      continue;
    }

    for (const item of group.items) {
      cards.push({
        kind: "individual",
        id: item.id,
        category: group.category,
        title: item.title,
        subtitle: item.subtitle,
      });
    }
  }

  return cards;
}

export function formatGalleryCardLabel(card: FormatGalleryCard): string {
  if (card.kind === "collection") {
    return `${card.title} — ${card.count} generated`;
  }
  return card.title;
}

/** Width:height aspect ratio per content type (featured card excluded). */
export type FormatCardAspect = "16:9" | "3:4" | "9:16" | "8.5:11" | "1:1";

export function formatGalleryCardAspect(card: FormatGalleryCard): FormatCardAspect {
  if (card.kind === "collection") return "1:1";

  const category = card.category.toLowerCase();
  if (category.includes("youtube")) return "16:9";
  if (category.includes("linkedin")) return "3:4";
  if (category.includes("short")) return "9:16";
  if (category.includes("newsletter")) return "8.5:11";

  return "3:4";
}
