import type { FormatPlatformId } from "./formatPlatforms";

type PlatformContentCost = {
  /** Words per output at maximum density (slider = 100). */
  dense: number;
  /** Words per output at minimum density (slider = 0). */
  sparse: number;
};

export const FORMAT_PLATFORM_CONTENT_COSTS: Record<FormatPlatformId, PlatformContentCost> = {
  x: { dense: 20, sparse: 80 },
  linkedin: { dense: 250, sparse: 1000 },
  youtube: { dense: 500, sparse: 2000 },
  tiktok: { dense: 50, sparse: 200 },
  substack: { dense: 1000, sparse: 3000 },
  instagram: { dense: 100, sparse: 400 },
};

/** Map slider 0 (sparse) → 100 (dense) to words-per-output for the platform. */
export function contentCostForSlider(slider: number, platform: FormatPlatformId): number {
  const { dense, sparse } = FORMAT_PLATFORM_CONTENT_COSTS[platform];
  const density = Math.min(100, Math.max(0, slider)) / 100;
  return sparse + (dense - sparse) * density;
}

export function estimateFormatOutputCount(
  essayWordCount: number,
  slider: number,
  platform: FormatPlatformId,
): number {
  if (essayWordCount <= 0) return 0;
  const contentCost = contentCostForSlider(slider, platform);
  const rounded = Math.round(essayWordCount / contentCost);
  return Math.max(1, rounded);
}

function formatOutputUnit(count: number, platform: FormatPlatformId): string {
  switch (platform) {
    case "x":
      return count === 1 ? "Tweet" : "Tweets";
    case "youtube":
      return count === 1 ? "YouTube script" : "YouTube scripts";
    case "linkedin":
      return count === 1 ? "LinkedIn post" : "LinkedIn posts";
    case "tiktok":
      return count === 1 ? "short-form script" : "short-form scripts";
    case "substack":
      return count === 1 ? "newsletter" : "newsletters";
    case "instagram":
      return count === 1 ? "post" : "posts";
  }
}

export function formatPlatformOutputEstimate(
  essayWordCount: number,
  slider: number,
  platform: FormatPlatformId,
): string {
  const count = estimateFormatOutputCount(essayWordCount, slider, platform);
  if (count === 0) return "Estimated: 0 outputs";
  return `Estimated: ${count} ${formatOutputUnit(count, platform)}`;
}
