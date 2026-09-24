import { describe, expect, it } from "vitest";
import {
  DEFAULT_TYPEWRITER_LINE_HEIGHT_PX,
  TYPEWRITER_PAD_VAR,
  applyTypewriterPadding,
  caretCoordsForTypewriter,
  clearTypewriterPadding,
  typewriterPaddingPx,
  typewriterScrollTop,
} from "./typewriterScrolling";

describe("typewriterPaddingPx", () => {
  it("leaves enough space for the first line to sit in the middle", () => {
    expect(typewriterPaddingPx(800, 24)).toBe(388);
  });

  it("never goes negative on a short scroller", () => {
    expect(typewriterPaddingPx(10, 24)).toBe(0);
  });

  it("uses the default line height when omitted", () => {
    expect(typewriterPaddingPx(800)).toBe(typewriterPaddingPx(800, DEFAULT_TYPEWRITER_LINE_HEIGHT_PX));
  });
});

describe("typewriterScrollTop", () => {
  it("scrolls down when the caret is below the middle", () => {
    expect(
      typewriterScrollTop({
        caretTopPx: 500,
        caretBottomPx: 524,
        scrollerTopPx: 0,
        scrollerHeightPx: 800,
        currentScrollTopPx: 0,
        maxScrollTopPx: 2000,
      }),
    ).toBe(112);
  });

  it("scrolls up when the caret is above the middle", () => {
    expect(
      typewriterScrollTop({
        caretTopPx: 100,
        caretBottomPx: 124,
        scrollerTopPx: 0,
        scrollerHeightPx: 800,
        currentScrollTopPx: 200,
        maxScrollTopPx: 2000,
      }),
    ).toBe(0);
  });

  it("clamps to the max scroll so the last line can rest on the typewriter line", () => {
    expect(
      typewriterScrollTop({
        caretTopPx: 900,
        caretBottomPx: 924,
        scrollerTopPx: 0,
        scrollerHeightPx: 800,
        currentScrollTopPx: 0,
        maxScrollTopPx: 40,
      }),
    ).toBe(40);
  });

  it("keeps scroll at 0 when a short page cannot move", () => {
    expect(
      typewriterScrollTop({
        caretTopPx: 388,
        caretBottomPx: 412,
        scrollerTopPx: 0,
        scrollerHeightPx: 800,
        currentScrollTopPx: 0,
        maxScrollTopPx: 0,
      }),
    ).toBe(0);
  });
});

describe("applyTypewriterPadding", () => {
  it("stores pad as a CSS variable so layout is not rewritten every keystroke", () => {
    const el = document.createElement("div");
    expect(applyTypewriterPadding(el, 800, 24)).toBe(388);
    expect(el.style.getPropertyValue(TYPEWRITER_PAD_VAR)).toBe("388px");
    clearTypewriterPadding(el);
    expect(el.style.getPropertyValue(TYPEWRITER_PAD_VAR)).toBe("");
  });
});

describe("caretCoordsForTypewriter", () => {
  it("reads the selection head from the view", () => {
    const caret = caretCoordsForTypewriter({
      state: { selection: { head: 4 } },
      coordsAtPos: (pos) => {
        expect(pos).toBe(4);
        return { top: 120, bottom: 144 };
      },
    });
    expect(caret).toEqual({ top: 120, bottom: 144 });
  });

  it("falls back when the caret box has no height", () => {
    const caret = caretCoordsForTypewriter({
      state: { selection: { head: 1 } },
      coordsAtPos: () => ({ top: 50, bottom: 50 }),
    });
    expect(caret).toEqual({
      top: 50,
      bottom: 50 + DEFAULT_TYPEWRITER_LINE_HEIGHT_PX,
    });
  });

  it("returns null when coordsAtPos throws", () => {
    expect(
      caretCoordsForTypewriter({
        state: { selection: { head: 0 } },
        coordsAtPos: () => {
          throw new Error("destroyed");
        },
      }),
    ).toBeNull();
  });
});
