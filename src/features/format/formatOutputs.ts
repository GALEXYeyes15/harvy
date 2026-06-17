import type { FormatGenerationOrchestratorResult } from "./generation/orchestratorTypes";
import { isFormatCategorySuccess } from "./generation/orchestratorResults";
import { estimateFormatOutputCount } from "./formatOutputEstimation";
import {
  FORMAT_CATEGORIES,
  type FormatCategoryAmounts,
  type FormatCategoryId,
  type FormatCategorySelection,
} from "./formatCategories";

export type FormatGalleryCard =
  | {
      kind: "collection";
      id: string;
      categoryId: FormatCategoryId;
      category: string;
      title: string;
      count: number;
      loading?: boolean;
      error?: string;
    }
  | {
      kind: "individual";
      id: string;
      categoryId: FormatCategoryId;
      category: string;
      title: string;
      index: number;
      content?: string;
      loading?: boolean;
      error?: string;
    };

export const CATEGORY_WORKSPACE_CARD_TITLE: Record<FormatCategoryId, string> = {
  tweets_notes: "Tweets / Notes",
  mid_form_post: "Mid Form Post",
  short_form_outline: "Short Form Outline",
  long_form_outline: "Long Form Outline",
  newsletter: "Newsletter",
  podcast_notes: "Podcast Notes",
};

const CATEGORY_GALLERY_LABEL: Record<FormatCategoryId, string> = {
  tweets_notes: "Tweets / Notes",
  mid_form_post: "Mid Form Post",
  short_form_outline: "Short Form Outline",
  long_form_outline: "Long Form Outline",
  newsletter: "Newsletter",
  podcast_notes: "Podcast Notes",
};

export type BuildFormatWorkspaceCardsInput = {
  selection: FormatCategorySelection;
  categoryAmounts: FormatCategoryAmounts;
  wordCount: number;
  isGenerating: boolean;
  orchestratorResults: FormatGenerationOrchestratorResult | null;
  generatedTweetsNotesCount: number | null;
};

function categoryOutputCount(
  categoryId: FormatCategoryId,
  wordCount: number,
  categoryAmounts: FormatCategoryAmounts,
): number {
  return estimateFormatOutputCount(wordCount, categoryAmounts[categoryId], categoryId);
}

function categoryJobError(
  categoryId: FormatCategoryId,
  orchestratorResults: FormatGenerationOrchestratorResult | null,
): string | undefined {
  const result = orchestratorResults?.[categoryId];
  if (result?.status === "error") return result.error;
  return undefined;
}

function categoryOutputs(
  categoryId: FormatCategoryId,
  orchestratorResults: FormatGenerationOrchestratorResult | null,
): string[] {
  const result = orchestratorResults?.[categoryId];
  if (!isFormatCategorySuccess(result)) return [];
  return result.outputs.map((output) => output.content);
}

/** Build gallery cards from selected categories and amount sliders. */
export function buildFormatWorkspaceCards(input: BuildFormatWorkspaceCardsInput): FormatGalleryCard[] {
  const cards: FormatGalleryCard[] = [];

  for (const { id: categoryId } of FORMAT_CATEGORIES) {
    if (!input.selection[categoryId]) continue;

    const category = CATEGORY_GALLERY_LABEL[categoryId];
    const title = CATEGORY_WORKSPACE_CARD_TITLE[categoryId];
    const outputCount = categoryOutputCount(categoryId, input.wordCount, input.categoryAmounts);
    const loading = input.isGenerating;
    const error = loading ? undefined : categoryJobError(categoryId, input.orchestratorResults);
    const outputs = categoryOutputs(categoryId, input.orchestratorResults);

    if (categoryId === "tweets_notes") {
      const count =
        input.generatedTweetsNotesCount ??
        (outputs.length > 0 ? outputs.length : outputCount > 0 ? outputCount : 1);

      cards.push({
        kind: "collection",
        id: "collection-tweets-notes",
        categoryId: "tweets_notes",
        category,
        title,
        count,
        loading,
        error,
      });
      continue;
    }

    const cardCount = Math.max(outputCount, 1);
    for (let index = 0; index < cardCount; index += 1) {
      cards.push({
        kind: "individual",
        id: `${categoryId}-${index + 1}`,
        categoryId,
        category,
        title,
        index: index + 1,
        content: outputs[index],
        loading,
        error: index === 0 ? error : undefined,
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

export type FormatCardAspect = "16:9" | "3:4" | "9:16" | "8.5:11" | "1:1";

export function formatGalleryCardAspect(card: FormatGalleryCard): FormatCardAspect {
  if (card.kind === "collection") return "1:1";

  switch (card.categoryId) {
    case "long_form_outline":
      return "16:9";
    case "newsletter":
      return "8.5:11";
    case "mid_form_post":
      return "3:4";
    case "podcast_notes":
      return "3:4";
    case "short_form_outline":
      return "9:16";
    case "tweets_notes":
    default:
      return "3:4";
  }
}
