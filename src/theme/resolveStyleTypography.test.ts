import { describe, expect, it } from "vitest";
import {
  DEFAULT_STYLE_TYPOGRAPHY,
  resolveStyleTypography,
  STYLE_TYPOGRAPHY_LIMITS,
} from "./appearanceStyles";

describe("resolveStyleTypography", () => {
  it("returns defaults when fields are missing", () => {
    expect(resolveStyleTypography({})).toEqual(DEFAULT_STYLE_TYPOGRAPHY);
  });

  it("clamps and snaps font size to half-pixel steps", () => {
    expect(resolveStyleTypography({ fontSizePx: 34.4 }).fontSizePx).toBe(34.5);
    expect(resolveStyleTypography({ fontSizePx: 100 }).fontSizePx).toBe(
      STYLE_TYPOGRAPHY_LIMITS.fontSizePx.max,
    );
  });

  it("clamps letter-spacing and line-height", () => {
    expect(resolveStyleTypography({ letterSpacingPx: -9 }).letterSpacingPx).toBe(
      STYLE_TYPOGRAPHY_LIMITS.letterSpacingPx.min,
    );
    expect(resolveStyleTypography({ lineHeight: 0.5 }).lineHeight).toBe(
      STYLE_TYPOGRAPHY_LIMITS.lineHeight.min,
    );
  });
});
