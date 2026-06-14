import type { FormatCategoryId } from "./formatCategories";

type CategoryContentCost = {
  dense: number;
  sparse: number;
};

export const FORMAT_CATEGORY_CONTENT_COSTS: Record<FormatCategoryId, CategoryContentCost> = {
  tweets_notes: { dense: 20, sparse: 80 },
  short_form_outline: { dense: 50, sparse: 200 },
  long_form_outline: { dense: 500, sparse: 2000 },
  newsletter: { dense: 1000, sparse: 3000 },
  podcast_notes: { dense: 250, sparse: 1000 },
};

export function contentCostForSlider(slider: number, category: FormatCategoryId): number {
  const { dense, sparse } = FORMAT_CATEGORY_CONTENT_COSTS[category];
  const density = Math.min(100, Math.max(0, slider)) / 100;
  return sparse + (dense - sparse) * density;
}

export function estimateFormatOutputCount(
  essayWordCount: number,
  slider: number,
  category: FormatCategoryId,
): number {
  if (essayWordCount <= 0) return 0;
  const contentCost = contentCostForSlider(slider, category);
  const rounded = Math.round(essayWordCount / contentCost);
  return Math.max(1, rounded);
}

function formatOutputUnit(count: number, category: FormatCategoryId): string {
  switch (category) {
    case "tweets_notes":
      return count === 1 ? "tweet / note" : "tweets / notes";
    case "short_form_outline":
      return count === 1 ? "short form outline" : "short form outlines";
    case "long_form_outline":
      return count === 1 ? "long form outline" : "long form outlines";
    case "newsletter":
      return count === 1 ? "newsletter" : "newsletters";
    case "podcast_notes":
      return count === 1 ? "podcast note" : "podcast notes";
  }
}

export function formatCategoryOutputEstimate(
  essayWordCount: number,
  slider: number,
  category: FormatCategoryId,
): string {
  const count = estimateFormatOutputCount(essayWordCount, slider, category);
  if (count === 0) return "Estimated: 0 outputs";
  return `Estimated: ${count} ${formatOutputUnit(count, category)}`;
}
