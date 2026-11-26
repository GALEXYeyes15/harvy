import type { EditorView } from "@tiptap/pm/view";
import {
  focusParagraphAfterHarvyWriterImageInTr,
  focusParagraphBeforeHarvyWriterImageInTr,
} from "./harvyWriterImageInsertion";

export type HarvyWriterImageAdjacentSide = "before-image" | "after-image";

const IMAGE_INTERACTIVE_SELECTOR =
  "button, input, textarea, a, .harvy-image-node__toolbar, .harvy-image-source-popover, .harvy-image-node__caption, figcaption, [aria-labelledby='harvy-unsplash-browse-title']";

/** True when the event target is an image control, caption, or the bitmap itself. */
export function isHarvyWriterImageInteractiveTarget(target: Element): boolean {
  if (target.closest("img")) return true;
  return Boolean(target.closest(IMAGE_INTERACTIVE_SELECTOR));
}

export function resolveHarvyWriterImageAdjacentSide(event: MouseEvent, figure: Element): HarvyWriterImageAdjacentSide {
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

export function focusHarvyWriterImageAdjacentParagraph(
  view: EditorView,
  figure: Element,
  side: HarvyWriterImageAdjacentSide,
): boolean {
  const imagePos = view.posAtDOM(figure, 0);
  if (imagePos == null || imagePos < 0) return false;

  const { state } = view;
  const tr =
    side === "before-image"
      ? focusParagraphBeforeHarvyWriterImageInTr(state.tr, imagePos, state.schema)
      : focusParagraphAfterHarvyWriterImageInTr(state.tr, imagePos, state.schema);

  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/**
 * Route pointer events on image-adjacent chrome to a real paragraph TextSelection.
 * Returns true when handled (caller should preventDefault).
 */
export function handleHarvyWriterImageAdjacentPointerDown(view: EditorView, event: MouseEvent): boolean {
  if (!(event.target instanceof Element)) return false;

  const figure = event.target.closest("[data-harvy-image]");
  if (!figure || !view.dom.contains(figure)) return false;
  if (isHarvyWriterImageInteractiveTarget(event.target)) return false;

  event.preventDefault();
  event.stopPropagation();

  const side = resolveHarvyWriterImageAdjacentSide(event, figure);
  focusHarvyWriterImageAdjacentParagraph(view, figure, side);

  if (event.target instanceof HTMLElement) event.target.blur();
  const zone = event.target.closest("[data-insertion-zone]");
  if (zone instanceof HTMLElement) zone.blur();

  return true;
}
