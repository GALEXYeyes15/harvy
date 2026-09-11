import { describe, expect, it } from "vitest";
import { CYBER_BODY_FONT_ID } from "./appearanceFonts";
import {
  builtInClassicAppearanceStyle,
  builtInCyberAppearanceStyle,
  DEFAULT_DARK_PALETTE,
  DEFAULT_LIGHT_PALETTE,
  duplicateAppearanceStyle,
  styleWithSeeds,
  type CustomAppearanceStyle,
} from "./appearanceStyles";

describe("duplicateAppearanceStyle", () => {
  it("clones the current custom style instead of Classic Light", () => {
    const source = styleWithSeeds(
      {
        id: "rivendell",
        name: "Rivendell",
        light: { ...DEFAULT_LIGHT_PALETTE },
        dark: { ...DEFAULT_LIGHT_PALETTE },
        bodyFont: "ibm-plex-mono",
        fontSizePx: 22,
        letterSpacingPx: 0.8,
        lineHeight: 1.9,
      } satisfies CustomAppearanceStyle,
      {
        canvas: "#1a2e1a",
        ink: "#e8f0d8",
        muted: "#243824",
        accent: "#c4a35a",
      },
    );

    const copy = duplicateAppearanceStyle(source, "light");

    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe("New theme");
    expect(copy.seeds).toEqual(source.seeds);
    expect(copy.light.canvas).toBe("#1a2e1a");
    expect(copy.dark.canvas).toBe("#1a2e1a");
    expect(copy.bodyFont).toBe("ibm-plex-mono");
    expect(copy.fontSizePx).toBe(22);
    expect(copy.letterSpacingPx).toBe(0.8);
    expect(copy.lineHeight).toBe(1.9);
  });

  it("keeps Classic Dark colors when duplicating Classic in dark mode", () => {
    const copy = duplicateAppearanceStyle(builtInClassicAppearanceStyle(), "dark");
    expect(copy.id).not.toBe("classic");
    expect(copy.light.canvas).toBe(DEFAULT_DARK_PALETTE.canvas);
    expect(copy.light.ink).toBe(DEFAULT_DARK_PALETTE.ink);
    expect(copy.dark.canvas).toBe(DEFAULT_DARK_PALETTE.canvas);
  });

  it("keeps Classic Light colors when duplicating Classic in light mode", () => {
    const copy = duplicateAppearanceStyle(builtInClassicAppearanceStyle(), "light");
    expect(copy.light.canvas).toBe(DEFAULT_LIGHT_PALETTE.canvas);
    expect(copy.light.ink).toBe(DEFAULT_LIGHT_PALETTE.ink);
  });

  it("copies Cyber’s visible look and body font", () => {
    const cyber = builtInCyberAppearanceStyle();
    const copy = duplicateAppearanceStyle(cyber, "dark");
    expect(copy.bodyFont).toBe(CYBER_BODY_FONT_ID);
    expect(copy.light.canvas).toBe(cyber.dark.canvas);
    expect(copy.dark.accent).toBe(cyber.dark.accent);
  });
});
