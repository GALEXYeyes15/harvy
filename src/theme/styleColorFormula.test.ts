import { describe, expect, it } from "vitest";
import {
  deriveBasicsFromSeeds,
  derivePairFromSeed,
  hexToHsl,
} from "./styleColorFormula";

describe("derivePairFromSeed", () => {
  it("turns a vivid cyan canvas seed into pale light + dark void", () => {
    const pair = derivePairFromSeed("#03daff", "surface");
    const light = hexToHsl(pair.light)!;
    const dark = hexToHsl(pair.dark)!;
    expect(light.l).toBeGreaterThan(0.9);
    expect(dark.l).toBeLessThan(0.15);
    // Hue should stay in the cyan family (roughly 0.45–0.55 of the circle).
    expect(Math.abs(light.h - dark.h)).toBeLessThan(0.05);
  });

  it("maps ink seed to dark text in light mode and light text in dark mode", () => {
    const pair = derivePairFromSeed("#03daff", "ink");
    expect(hexToHsl(pair.light)!.l).toBeLessThan(0.35);
    expect(hexToHsl(pair.dark)!.l).toBeGreaterThan(0.8);
  });

  it("keeps accent the same in both modes", () => {
    const pair = derivePairFromSeed("#03daff", "accent");
    expect(pair.light).toBe(pair.dark);
  });

  it("builds light and dark basics from seeds", () => {
    const { light, dark } = deriveBasicsFromSeeds({
      canvas: "#03daff",
      ink: "#0a2a2a",
      muted: "#2a6a6a",
      accent: "#03daff",
    });
    expect(hexToHsl(light.canvas)!.l).toBeGreaterThan(hexToHsl(dark.canvas)!.l);
    expect(hexToHsl(light.ink)!.l).toBeLessThan(hexToHsl(dark.ink)!.l);
  });
});
