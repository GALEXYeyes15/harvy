import { describe, expect, it } from "vitest";
import { EDITOR_COLUMN_BASE_PX, editorColumnLayout } from "./editorColumnLayout";

describe("editorColumnLayout", () => {
  it("keeps the 820px column window-centered when expansion is 0 and sidebars are closed", () => {
    const layout = editorColumnLayout({
      baseWidthPx: EDITOR_COLUMN_BASE_PX,
      lineExpansionPx: 0,
      windowWidthPx: 1800,
      leftReservePx: 0,
      rightReservePx: 0,
    });
    expect(layout.maxWidthPx).toBe(820);
    expect(layout.paddingLeftPx).toBe(490);
    expect(layout.paddingRightPx).toBe(490);
  });

  it("does not grow into overlay sidebars", () => {
    const layout = editorColumnLayout({
      baseWidthPx: EDITOR_COLUMN_BASE_PX,
      lineExpansionPx: 800,
      windowWidthPx: 1800,
      leftReservePx: 260,
      rightReservePx: 300,
    });
    expect(layout.maxWidthPx).toBe(1240);
    expect(layout.paddingLeftPx).toBe(260);
    expect(layout.paddingRightPx).toBe(300);
  });

  it("stays window-centered when expanded width still clears the sidebars", () => {
    const layout = editorColumnLayout({
      baseWidthPx: EDITOR_COLUMN_BASE_PX,
      lineExpansionPx: 0,
      windowWidthPx: 1800,
      leftReservePx: 260,
      rightReservePx: 300,
    });
    expect(layout.maxWidthPx).toBe(820);
    expect(layout.paddingLeftPx).toBe(490);
    expect(layout.paddingRightPx).toBe(490);
  });

  it("shifts off-center when a single sidebar would overlap a centered column", () => {
    const layout = editorColumnLayout({
      baseWidthPx: EDITOR_COLUMN_BASE_PX,
      lineExpansionPx: 200,
      windowWidthPx: 1200,
      leftReservePx: 0,
      rightReservePx: 300,
    });
    expect(layout.maxWidthPx).toBe(900);
    expect(layout.paddingRightPx).toBe(300);
    expect(layout.paddingLeftPx).toBe(0);
  });
});
