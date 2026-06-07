import type { MouseEvent } from "react";
import { openExternalHref, resolveUnsplashWebsiteUrl } from "./harvyImageAttribution";

type UnsplashAttributionCaptionProps = {
  photographerName: string;
  photographerUrl: string;
  unsplashUrl?: string;
};

function CaptionLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    openExternalHref(href, event);
  };

  return (
    <a
      href={href}
      className="harvy-editor-link underline decoration-from-font underline-offset-[0.12em]"
      target="_blank"
      rel="noopener noreferrer"
      onMouseDown={open}
      onClick={open}
    >
      {children}
    </a>
  );
}

export function UnsplashAttributionCaption({
  photographerName,
  photographerUrl,
  unsplashUrl,
}: UnsplashAttributionCaptionProps) {
  const artistHref = photographerUrl.trim() || "#";
  const unsplashHref = resolveUnsplashWebsiteUrl(unsplashUrl);

  return (
    <figcaption className="harvy-image-node__caption harvy-image-node__caption--rich">
      Photo by{" "}
      <CaptionLink href={artistHref}>{photographerName}</CaptionLink> on{" "}
      <CaptionLink href={unsplashHref}>Unsplash</CaptionLink>
    </figcaption>
  );
}
