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

  it("keeps the left edge and trims from the right when the right sidebar overlaps", () => {
    const layout = editorColumnLayout({
      baseWidthPx: EDITOR_COLUMN_BASE_PX,
      lineExpansionPx: 200,
      windowWidthPx: 1200,
      leftReservePx: 0,
      rightReservePx: 300,
    });
    expect(layout.paddingLeftPx).toBe(90);
    expect(layout.maxWidthPx).toBe(810);
    expect(layout.paddingRightPx).toBe(300);
  });

  it("keeps the closed-sidebar left edge when both sidebars open and the column must narrow", () => {
    const closed = editorColumnLayout({
      baseWidthPx: EDITOR_COLUMN_BASE_PX,
      lineExpansionPx: 200,
      windowWidthPx: 1600,
      leftReservePx: 0,
      rightReservePx: 0,
    });
    const open = editorColumnLayout({
      baseWidthPx: EDITOR_COLUMN_BASE_PX,
      lineExpansionPx: 200,
      windowWidthPx: 1600,
      leftReservePx: 260,
      rightReservePx: 300,
    });
    expect(open.paddingLeftPx).toBe(closed.paddingLeftPx);
    expect(open.maxWidthPx).toBe(1600 - 290 - 300);
  });

  it("moves the left edge only when the left sidebar would cover it", () => {
    const layout = editorColumnLayout({
      baseWidthPx: EDITOR_COLUMN_BASE_PX,
      lineExpansionPx: 200,
      windowWidthPx: 1200,
      leftReservePx: 260,
      rightReservePx: 0,
    });
    expect(layout.paddingLeftPx).toBe(260);
    expect(layout.maxWidthPx).toBe(940);
  });
});
