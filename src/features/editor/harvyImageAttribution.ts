export const UNSPLASH_WEBSITE_URL = "https://unsplash.com";

/** Canonical Unsplash homepage stored on image blocks and used in caption links. */
export const DEFAULT_UNSPLASH_URL = UNSPLASH_WEBSITE_URL;

/** Caption “Unsplash” links always point to the homepage (ignore legacy stored URLs). */
export function resolveUnsplashWebsiteUrl(_stored?: string | null): string {
  return UNSPLASH_WEBSITE_URL;
}

export function openExternalHref(href: string, event: { preventDefault: () => void; stopPropagation: () => void }): void {
  event.preventDefault();
  event.stopPropagation();
  const url = href.trim();
  if (!url || url === "#") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

export type HarvyImageSource = "unsplash" | null;

export type HarvyImageLoadAttrs = {
  src: string;
  caption?: string;
  captionHtml?: string;
  width?: import("./harvyImage").HarvyImageWidth;
  imageSource?: HarvyImageSource;
  photographerName?: string;
  photographerUrl?: string;
  unsplashUrl?: string;
};

export type UnsplashAttributionInput = {
  photographerName: string;
  photographerUrl: string;
  unsplashUrl?: string;
};

export function isUnsplashFigure(fig: HTMLElement): boolean {
  return (
    fig.getAttribute("data-image-source") === "unsplash" &&
    Boolean(fig.getAttribute("data-photographer-name")?.trim())
  );
}

/** Rebuild caption HTML from figure metadata (canonical Unsplash homepage link). */
export function buildUnsplashCaptionHtmlFromFigure(fig: HTMLElement): string {
  const photographerName = fig.getAttribute("data-photographer-name")?.trim() ?? "";
  if (!photographerName) return "";
  return buildUnsplashAttribution({
    photographerName,
    photographerUrl: fig.getAttribute("data-photographer-url")?.trim() ?? "#",
  }).captionHtml;
}

/** Strip legacy referral/query params from stored Unsplash caption links. */
export function sanitizeUnsplashCaptionHtml(html: string): string {
  if (!html) return html;
  return html.replace(
    /(<a\b[^>]*\bhref=["'])https?:\/\/unsplash\.com\/?(?:\?[^"'#]*)?(["'])/gi,
    "$1https://unsplash.com$2",
  );
}

export function buildUnsplashAttribution(input: UnsplashAttributionInput): {
  caption: string;
  captionHtml: string;
} {
  const photographerName = input.photographerName.trim();
  const photographerUrl = input.photographerUrl.trim();
  const unsplashLink = resolveUnsplashWebsiteUrl(input.unsplashUrl);
  const caption = `Photo by ${photographerName} on Unsplash`;
  const captionHtml = `Photo by <a href="${escapeHtmlAttr(photographerUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtmlText(photographerName)}</a> on <a href="${escapeHtmlAttr(unsplashLink)}" target="_blank" rel="noopener noreferrer">Unsplash</a>`;
  return { caption, captionHtml };
}

export function isManuallyEditedUnsplashCaption(attrs: {
  imageSource?: HarvyImageSource | null;
  caption?: string;
  photographerName?: string;
  photographerUrl?: string;
  unsplashUrl?: string;
}): boolean {
  if (attrs.imageSource !== "unsplash") return false;
  const photographerName = (attrs.photographerName ?? "").trim();
  const caption = (attrs.caption ?? "").trim();
  if (!photographerName) return Boolean(caption);
  const auto = buildUnsplashAttribution({
    photographerName,
    photographerUrl: attrs.photographerUrl ?? "",
    unsplashUrl: attrs.unsplashUrl,
  }).caption;
  return caption !== auto;
}

export function buildUnsplashLoadAttrs(
  src: string,
  input: UnsplashAttributionInput,
): HarvyImageLoadAttrs {
  const { caption, captionHtml } = buildUnsplashAttribution(input);
  return {
    src,
    imageSource: "unsplash",
    photographerName: input.photographerName.trim(),
    photographerUrl: input.photographerUrl.trim(),
    unsplashUrl: UNSPLASH_WEBSITE_URL,
    caption,
    captionHtml,
  };
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttr(value: string): string {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}
