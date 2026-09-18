import { describe, expect, it } from "vitest";
import {
  clampSystemBodyFontSize,
  clampSystemLineExpansion,
  DEFAULT_SYSTEM_BODY_FONT_SIZE_PX,
  DEFAULT_SYSTEM_LINE_EXPANSION_PX,
  SYSTEM_BODY_FONT_SIZE_LIMITS,
  SYSTEM_LINE_EXPANSION_LIMITS,
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

describe("clampSystemLineExpansion", () => {
  it("defaults to 0", () => {
    expect(DEFAULT_SYSTEM_LINE_EXPANSION_PX).toBe(0);
    expect(clampSystemLineExpansion(undefined)).toBe(0);
  });

  it("clamps to 20px steps", () => {
    expect(clampSystemLineExpansion(-40)).toBe(SYSTEM_LINE_EXPANSION_LIMITS.min);
    expect(clampSystemLineExpansion(800)).toBe(SYSTEM_LINE_EXPANSION_LIMITS.max);
    expect(clampSystemLineExpansion(25)).toBe(20);
  });
});
