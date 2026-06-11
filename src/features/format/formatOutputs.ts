import type { GeneratedTwitterCollection } from "./formatGeneratedOutputs";
import type { FormatPlatformId, FormatPlatformSelection } from "./formatPlatforms";

/** Minimum items in a category before it collapses into one collection card. */
export const FORMAT_COLLECTION_THRESHOLD = 5;

export type FormatOutputItem = {
  id: string;
  title: string;
  subtitle?: string;
};

export type FormatCategoryGroup = {
  category: string;
  platform: FormatPlatformId;
  items: FormatOutputItem[];
};

export type FormatGalleryCard =
  | {
      kind: "individual";
      id: string;
      platform: FormatPlatformId;
      category: string;
      title: string;
      subtitle?: string;
    }
  | {
      kind: "collection";
      id: string;
      platform: FormatPlatformId;
      category: string;
      title: string;
      count: number;
    };

/** Placeholder outputs — no generation yet. */
export const PLACEHOLDER_FORMAT_GROUPS: FormatCategoryGroup[] = [
  {
    category: "Tweets",
    platform: "x",
    items: Array.from({ length: 50 }, (_, index) => ({
      id: `tweet-${index + 1}`,
      title: `Tweet ${index + 1}`,
      subtitle: "Social post",
    })),
  },
  {
    category: "YouTube scripts",
    platform: "youtube",
    items: [
      { id: "yt-1", title: "Opening hook", subtitle: "YouTube script" },
      { id: "yt-2", title: "Product walkthrough", subtitle: "YouTube script" },
      { id: "yt-3", title: "Outro CTA", subtitle: "YouTube script" },
    ],
  },
  {
    category: "Newsletter",
    platform: "substack",
    items: [
      { id: "nl-1", title: "Weekly digest", subtitle: "Newsletter" },
      { id: "nl-2", title: "Launch announcement", subtitle: "Newsletter" },
    ],
  },
  {
    category: "Instagram posts",
    platform: "instagram",
    items: [
      { id: "ig-1", title: "Carousel hook", subtitle: "Instagram post" },
      { id: "ig-2", title: "Story caption", subtitle: "Instagram post" },
      { id: "ig-3", title: "Reel script", subtitle: "Instagram post" },
    ],
  },
  {
    category: "LinkedIn posts",
    platform: "linkedin",
    items: [
      { id: "li-1", title: "Founder story", subtitle: "LinkedIn post" },
      { id: "li-2", title: "Product update", subtitle: "LinkedIn post" },
      { id: "li-3", title: "Hiring note", subtitle: "LinkedIn post" },
      { id: "li-4", title: "Customer win", subtitle: "LinkedIn post" },
    ],
  },
  {
    category: "Short form scripts",
    platform: "tiktok",
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
        platform: group.platform,
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
        platform: group.platform,
        category: group.category,
        title: item.title,
        subtitle: item.subtitle,
      });
    }
  }

  return cards;
}

export function applyGeneratedTwitterCollection(
  cards: FormatGalleryCard[],
  generated: GeneratedTwitterCollection | null,
): FormatGalleryCard[] {
  if (!generated) return cards;
  return cards.map((card) => {
    if (card.kind === "collection" && card.platform === "x") {
      return {
        ...card,
        title: "Tweets",
        count: generated.tweets.length,
      };
    }
    return card;
  });
}

export function filterFormatGalleryCards(
  cards: FormatGalleryCard[],
  selection: FormatPlatformSelection,
): FormatGalleryCard[] {
  return cards.filter((card) => selection[card.platform]);
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

  switch (card.platform) {
    case "youtube":
      return "16:9";
    case "linkedin":
    case "instagram":
      return "3:4";
    case "tiktok":
      return "9:16";
    case "substack":
      return "8.5:11";
    case "x":
    default:
      return "3:4";
  }
}
