import { describe, expect, it } from "vitest";
import {
  clampSystemBodyFontSize,
  DEFAULT_SYSTEM_BODY_FONT_SIZE_PX,
  SYSTEM_BODY_FONT_SIZE_LIMITS,
} from "./systemTypography";

describe("clampSystemBodyFontSize", () => {
  it("defaults to 12", () => {
    expect(DEFAULT_SYSTEM_BODY_FONT_SIZE_PX).toBe(12);
    expect(clampSystemBodyFontSize(undefined)).toBe(12);
  });

  it("clamps to the system range", () => {
    expect(clampSystemBodyFontSize(4)).toBe(SYSTEM_BODY_FONT_SIZE_LIMITS.min);
    expect(clampSystemBodyFontSize(40)).toBe(SYSTEM_BODY_FONT_SIZE_LIMITS.max);
    expect(clampSystemBodyFontSize(14)).toBe(14);
  });
});
