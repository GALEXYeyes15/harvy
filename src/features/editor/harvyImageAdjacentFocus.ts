import type { EditorView } from "@tiptap/pm/view";
import {
  focusParagraphAfterHarvyImageInTr,
  focusParagraphBeforeHarvyImageInTr,
} from "./harvyImageInsertion";

export type HarvyImageAdjacentSide = "before-image" | "after-image";

const IMAGE_INTERACTIVE_SELECTOR =
  "button, input, textarea, a, .harvy-image-node__toolbar, .harvy-image-source-popover, .harvy-image-node__caption, figcaption, [aria-labelledby='harvy-unsplash-browse-title']";

/** True when the event target is an image control, caption, or the bitmap itself. */
export function isHarvyImageInteractiveTarget(target: Element): boolean {
  if (target.closest("img")) return true;
  return Boolean(target.closest(IMAGE_INTERACTIVE_SELECTOR));
}

export function resolveHarvyImageAdjacentSide(event: MouseEvent, figure: Element): HarvyImageAdjacentSide {
  const zone =
    event.target instanceof Element ? event.target.closest("[data-insertion-zone]") : null;
  if (zone) {
    const side = zone.getAttribute("data-insertion-zone");
    if (side === "before-image" || side === "after-image") return side;
  }

  const rect = figure.getBoundingClientRect();
  const mid = rect.top + rect.height / 2;
  return event.clientY < mid ? "before-image" : "after-image";
}

export function focusHarvyImageAdjacentParagraph(
  view: EditorView,
  figure: Element,
  side: HarvyImageAdjacentSide,
): boolean {
  const imagePos = view.posAtDOM(figure, 0);
  if (imagePos == null || imagePos < 0) return false;

  const { state } = view;
  const tr =
    side === "before-image"
      ? focusParagraphBeforeHarvyImageInTr(state.tr, imagePos, state.schema)
      : focusParagraphAfterHarvyImageInTr(state.tr, imagePos, state.schema);

  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/**
 * Route pointer events on image-adjacent chrome to a real paragraph TextSelection.
 * Returns true when handled (caller should preventDefault).
 */
export function handleHarvyImageAdjacentPointerDown(view: EditorView, event: MouseEvent): boolean {
  if (!(event.target instanceof Element)) return false;

  const figure = event.target.closest("[data-harvy-image]");
  if (!figure || !view.dom.contains(figure)) return false;
  if (isHarvyImageInteractiveTarget(event.target)) return false;

  event.preventDefault();
  event.stopPropagation();

  const side = resolveHarvyImageAdjacentSide(event, figure);
  focusHarvyImageAdjacentParagraph(view, figure, side);

  if (event.target instanceof HTMLElement) event.target.blur();
  const zone = event.target.closest("[data-insertion-zone]");
  if (zone instanceof HTMLElement) zone.blur();

  return true;
}
