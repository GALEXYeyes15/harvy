/**
 * Appearance style color formulas.
 *
 * Each role has a **seed** color (what you pick in the editor). From that seed we
 * derive both a light-mode and dark-mode hex, keeping hue and remapping lightness
 * into readable ranges — so a wild seed like `#03daff` still yields a pale light
 * surface and a near-black dark surface with the same cyan hue.
 *
 * Surface (canvas):
 *   light L = 0.94–0.98 (soft wash)    dark L = 0.05–0.12 (void)
 *
 * Ink:
 *   light L = 0.12–0.28 (dark text)    dark L = 0.85–0.95 (light text)
 *
 * Muted (chrome wells — notes, search, tab bar):
 *   light L = 0.86–0.96 (soft panel)   dark L = 0.08–0.20 (recessed)
 *
 * Accent:
 *   same vivid color in both modes (shown as a solid swatch)
 */

export type StyleColorRole = "surface" | "ink" | "muted" | "accent";

export type StyleBasics = {
  canvas: string;
  ink: string;
  muted: string;
  accent: string;
};

export type StyleColorPair = {
  light: string;
  dark: string;
};

type Hsl = { h: number; s: number; l: number };

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace("#", "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return [
      Number.parseInt(raw[0]! + raw[0]!, 16),
      Number.parseInt(raw[1]! + raw[1]!, 16),
      Number.parseInt(raw[2]! + raw[2]!, 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return [
      Number.parseInt(raw.slice(0, 2), 16),
      Number.parseInt(raw.slice(2, 4), 16),
      Number.parseInt(raw.slice(4, 6), 16),
    ];
  }
  if (/^[0-9a-fA-F]{8}$/.test(raw)) {
    return [
      Number.parseInt(raw.slice(0, 2), 16),
      Number.parseInt(raw.slice(2, 4), 16),
      Number.parseInt(raw.slice(4, 6), 16),
    ];
  }
  return null;
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return { h, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, h) * 255),
    Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  ];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function hexToHsl(hex: string): Hsl | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb[0], rgb[1], rgb[2]);
}

/**
 * Secondary UI text derived from ink so labels stay readable when the muted
 * seed is used for chrome wells (notes / search / tab bar).
 */
export function secondaryTextFromInk(inkHex: string): string {
  const hsl = hexToHsl(inkHex);
  if (!hsl) return inkHex;
  const l =
    hsl.l < 0.5
      ? clamp(hsl.l + 0.32, 0.42, 0.62)
      : clamp(hsl.l - 0.28, 0.42, 0.68);
  return toHex(hslToRgb(hsl.h, clamp(hsl.s * 0.4, 0, 0.4), l));
}

/** From a seed color, derive light-mode and dark-mode hexes for a semantic role. */
export function derivePairFromSeed(seedHex: string, role: StyleColorRole): StyleColorPair {
  const hsl = hexToHsl(seedHex);
  if (!hsl) return { light: seedHex, dark: seedHex };

  switch (role) {
    case "surface":
      return {
        light: toHex(
          hslToRgb(
            hsl.h,
            clamp(hsl.s * 0.28, 0, 0.35),
            clamp(0.94 + hsl.l * 0.04, 0.94, 0.985),
          ),
        ),
        dark: toHex(
          hslToRgb(
            hsl.h,
            clamp(hsl.s * 0.55, 0, 0.5),
            clamp(0.05 + (1 - hsl.l) * 0.04, 0.045, 0.12),
          ),
        ),
      };
    case "ink":
      // Keep the seed’s hue/chroma so picks read clearly; only remap lightness
      // for contrast (dark text in light mode, light text in dark mode).
      return {
        light: toHex(
          hslToRgb(
            hsl.h,
            clamp(Math.max(hsl.s, 0.2) * 0.85, 0.12, 0.8),
            clamp(Math.min(hsl.l, 0.22), 0.1, 0.3),
          ),
        ),
        dark: toHex(
          hslToRgb(
            hsl.h,
            clamp(Math.max(hsl.s, 0.15) * 0.7, 0.1, 0.65),
            clamp(Math.max(hsl.l, 0.82), 0.78, 0.96),
          ),
        ),
      };
    case "muted":
      // Chrome wells: light panels in light mode, recessed panels in dark mode.
      return {
        light: toHex(
          hslToRgb(
            hsl.h,
            clamp(hsl.s * 0.35, 0.04, 0.4),
            clamp(0.88 + hsl.l * 0.06, 0.86, 0.96),
          ),
        ),
        dark: toHex(
          hslToRgb(
            hsl.h,
            clamp(hsl.s * 0.45, 0.05, 0.45),
            clamp(0.1 + (1 - hsl.l) * 0.06, 0.08, 0.2),
          ),
        ),
      };
    case "accent": {
      const accent = toHex(
        hslToRgb(
          hsl.h,
          clamp(Math.max(hsl.s, 0.5), 0.25, 0.95),
          clamp(hsl.l, 0.42, 0.62),
        ),
      );
      return { light: accent, dark: accent };
    }
  }
}

/** Expand seeds into light + dark basics for palette building. */
export function deriveBasicsFromSeeds(seeds: StyleBasics): {
  light: StyleBasics;
  dark: StyleBasics;
} {
  const canvas = derivePairFromSeed(seeds.canvas, "surface");
  const ink = derivePairFromSeed(seeds.ink, "ink");
  const muted = derivePairFromSeed(seeds.muted, "muted");
  const accent = derivePairFromSeed(seeds.accent, "accent");
  return {
    light: {
      canvas: canvas.light,
      ink: ink.light,
      muted: muted.light,
      accent: accent.light,
    },
    dark: {
      canvas: canvas.dark,
      ink: ink.dark,
      muted: muted.dark,
      accent: accent.dark,
    },
  };
}

/** @deprecated Prefer deriveBasicsFromSeeds — kept for older call sites. */
export function deriveDarkBasics(light: StyleBasics): StyleBasics {
  return deriveBasicsFromSeeds(light).dark;
}

/** @deprecated Prefer derivePairFromSeed. */
export function deriveDarkHex(lightHex: string, role: StyleColorRole): string {
  return derivePairFromSeed(lightHex, role).dark;
}

export const STYLE_COLOR_FORMULA_SUMMARY = [
  "Pick a seed → both modes calculated (HSL, hue kept)",
  "Surface  light L≈0.96   dark L≈0.07",
  "Ink      light L≈0.18   dark L≈0.90",
  "Muted    light L≈0.90   dark L≈0.12  (wells)",
  "Accent   same vivid color in both modes",
].join("\n");
