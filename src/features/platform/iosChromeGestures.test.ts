import { describe, expect, it } from "vitest";
import { classifyIosChromeSwipe, type IosChromeSwipe } from "./iosChromeGestures";

function swipe(overrides: Partial<IosChromeSwipe> = {}): IosChromeSwipe {
  return {
    startX: 24,
    startY: 20,
    dx: 0,
    dy: 0,
    width: 744,
    chromeHidden: true,
    scrollerAtTop: false,
    leftSidebarOpen: false,
    rightSidebarOpen: false,
    onWritingSurface: false,
    onLeftSidebar: false,
    onRightSidebar: false,
    ...overrides,
  };
}

describe("classifyIosChromeSwipe", () => {
  it("opens the toolbar on a downward swipe from the top of the screen", () => {
    expect(classifyIosChromeSwipe(swipe({ dx: 4, dy: 80 }))).toBe("reveal-top-bar");
  });

  it("opens the toolbar when you pull down at the start of the page", () => {
    expect(
      classifyIosChromeSwipe(
        swipe({ startX: 300, startY: 240, dx: 0, dy: 70, onWritingSurface: true, scrollerAtTop: true }),
      ),
    ).toBe("reveal-top-bar");
  });

  it("lets a downward swipe in the middle of a document keep scrolling", () => {
    expect(
      classifyIosChromeSwipe(
        swipe({ startX: 300, startY: 400, dx: 2, dy: 90, onWritingSurface: true }),
      ),
    ).toBeNull();
  });

  it("leaves the toolbar alone when it is already showing", () => {
    expect(classifyIosChromeSwipe(swipe({ dx: 0, dy: 80, chromeHidden: false }))).toBeNull();
  });

  it("opens files on a rightward swipe from the left margin", () => {
    expect(classifyIosChromeSwipe(swipe({ dx: 90, dy: 8 }))).toBe("open-left-sidebar");
  });

  it("opens tools on a leftward swipe from the right margin", () => {
    expect(classifyIosChromeSwipe(swipe({ startX: 700, dx: -90, dy: 6 }))).toBe("open-right-sidebar");
  });

  it("does not steal a horizontal drag that starts on the writing", () => {
    expect(classifyIosChromeSwipe(swipe({ dx: 90, dy: 4, onWritingSurface: true }))).toBeNull();
  });

  it("closes an open sidebar when you swipe it back toward its edge", () => {
    expect(
      classifyIosChromeSwipe(swipe({ dx: -80, dy: 4, leftSidebarOpen: true, onLeftSidebar: true })),
    ).toBe("close-left-sidebar");
    expect(
      classifyIosChromeSwipe(
        swipe({ startX: 680, dx: 80, dy: 4, rightSidebarOpen: true, onRightSidebar: true }),
      ),
    ).toBe("close-right-sidebar");
  });

  it("ignores a short flick", () => {
    expect(classifyIosChromeSwipe(swipe({ dx: 20, dy: 4 }))).toBeNull();
    expect(classifyIosChromeSwipe(swipe({ dx: 2, dy: 20 }))).toBeNull();
  });
});
