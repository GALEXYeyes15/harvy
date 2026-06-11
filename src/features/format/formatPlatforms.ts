export const FORMAT_PLATFORMS = [
  { id: "x", label: "X / Twitter", brandColor: "#ffffff" },
  { id: "youtube", label: "YouTube", brandColor: "#ff0000" },
  { id: "substack", label: "Substack", brandColor: "#ff6719" },
  { id: "instagram", label: "Instagram", brandColor: "#e4405f" },
  { id: "tiktok", label: "TikTok", brandColor: "#25f4ee" },
  { id: "linkedin", label: "LinkedIn", brandColor: "#0a66c2" },
] as const;

export type FormatPlatformId = (typeof FORMAT_PLATFORMS)[number]["id"];

export type FormatPlatformSelection = Record<FormatPlatformId, boolean>;

export function defaultFormatPlatformSelection(): FormatPlatformSelection {
  return {
    x: true,
    youtube: true,
    substack: true,
    instagram: true,
    tiktok: true,
    linkedin: true,
  };
}

export type FormatPlatformAmounts = Record<FormatPlatformId, number>;

export const FORMAT_PLATFORM_AMOUNT_DEFAULT = 100;
export const FORMAT_PLATFORM_AMOUNT_MIN = 0;
export const FORMAT_PLATFORM_AMOUNT_MAX = 100;

export function defaultFormatPlatformAmounts(): FormatPlatformAmounts {
  return {
    x: FORMAT_PLATFORM_AMOUNT_DEFAULT,
    youtube: FORMAT_PLATFORM_AMOUNT_DEFAULT,
    substack: FORMAT_PLATFORM_AMOUNT_DEFAULT,
    instagram: FORMAT_PLATFORM_AMOUNT_DEFAULT,
    tiktok: FORMAT_PLATFORM_AMOUNT_DEFAULT,
    linkedin: FORMAT_PLATFORM_AMOUNT_DEFAULT,
  };
}

export function hasSelectedFormatPlatforms(selection: FormatPlatformSelection): boolean {
  return FORMAT_PLATFORMS.some((platform) => selection[platform.id]);
}
