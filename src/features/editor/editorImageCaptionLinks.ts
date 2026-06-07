import { openExternalHref } from "./harvyImageAttribution";

/** Open Unsplash attribution links inside image captions (ProseMirror otherwise swallows clicks). */
export function handleImageCaptionLinkPointerDown(event: MouseEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;

  const anchor = target.closest(".harvy-image-node__caption--rich a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;

  openExternalHref(anchor.href, event);
  return true;
}
