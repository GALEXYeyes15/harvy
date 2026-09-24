/** Fraction of the scroller height where the typing line sits (iA Writer Typewriter). */
export const TYPEWRITER_ANCHOR = 0.5;

export const DEFAULT_TYPEWRITER_LINE_HEIGHT_PX = 24;

export const TYPEWRITER_PAD_VAR = "--harvy-typewriter-pad";

export type TypewriterCaret = {
  top: number;
  bottom: number;
};

export type TypewriterCaretView = {
  state: { selection: { head: number } };
  coordsAtPos: (pos: number) => { top: number; bottom: number };
};

export type TypewriterScrollInput = {
  caretTopPx: number;
  caretBottomPx: number;
  scrollerTopPx: number;
  scrollerHeightPx: number;
  currentScrollTopPx: number;
  maxScrollTopPx: number;
};

/** Top/bottom padding so the first and last lines can sit on the typewriter line. */
export function typewriterPaddingPx(
  scrollerHeightPx: number,
  lineHeightPx: number = DEFAULT_TYPEWRITER_LINE_HEIGHT_PX,
): number {
  const height = Math.max(0, scrollerHeightPx);
  const line = Math.max(1, lineHeightPx);
  return Math.max(0, Math.round(height * TYPEWRITER_ANCHOR - line / 2));
}

/** Scroll offset that places the caret line on the typewriter line. */
export function typewriterScrollTop(input: TypewriterScrollInput): number {
  const scrollerHeightPx = Math.max(0, input.scrollerHeightPx);
  const caretHeight = Math.max(0, input.caretBottomPx - input.caretTopPx);
  const caretMid = input.caretTopPx + caretHeight / 2;
  const viewMid = input.scrollerTopPx + scrollerHeightPx * TYPEWRITER_ANCHOR;
  const maxScrollTopPx = Math.max(0, input.maxScrollTopPx);
  const next = input.currentScrollTopPx + (caretMid - viewMid);
  return Math.round(Math.min(maxScrollTopPx, Math.max(0, next)));
}

export function caretCoordsForTypewriter(view: TypewriterCaretView): TypewriterCaret | null {
  try {
    const coords = view.coordsAtPos(view.state.selection.head);
    if (!Number.isFinite(coords.top) || !Number.isFinite(coords.bottom)) return null;
    if (coords.bottom - coords.top < 1) {
      return {
        top: coords.top,
        bottom: coords.top + DEFAULT_TYPEWRITER_LINE_HEIGHT_PX,
      };
    }
    return { top: coords.top, bottom: coords.bottom };
  } catch {
    return null;
  }
}

/** Store pad on a parent as a CSS variable so React re-renders cannot wipe it. */
export function applyTypewriterPadding(
  target: HTMLElement,
  scrollerHeightPx: number,
  lineHeightPx: number = DEFAULT_TYPEWRITER_LINE_HEIGHT_PX,
): number {
  const pad = typewriterPaddingPx(scrollerHeightPx, lineHeightPx);
  const next = `${pad}px`;
  if (target.style.getPropertyValue(TYPEWRITER_PAD_VAR) !== next) {
    target.style.setProperty(TYPEWRITER_PAD_VAR, next);
  }
  return pad;
}

export function clearTypewriterPadding(target: HTMLElement): void {
  target.style.removeProperty(TYPEWRITER_PAD_VAR);
}

export function applyTypewriterScroll(scroller: HTMLElement, caret: TypewriterCaret): number {
  const rect = scroller.getBoundingClientRect();
  const next = typewriterScrollTop({
    caretTopPx: caret.top,
    caretBottomPx: caret.bottom,
    scrollerTopPx: rect.top,
    scrollerHeightPx: scroller.clientHeight,
    currentScrollTopPx: scroller.scrollTop,
    maxScrollTopPx: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
  });
  if (Math.abs(next - scroller.scrollTop) >= 1) {
    scroller.scrollTop = next;
  }
  return next;
}

/** Keep the caret's visual line on the typewriter line. Returns false if coords are unavailable. */
export function scrollTypewriterLine(view: TypewriterCaretView, scroller: HTMLElement): boolean {
  const caret = caretCoordsForTypewriter(view);
  if (!caret) return false;
  applyTypewriterScroll(scroller, caret);
  return true;
}
