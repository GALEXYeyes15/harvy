import type { ResolvedTheme } from "./themeMode";
import {
  appearanceBodyFontStack,
  bodyFontFromLegacyMono,
  CYBER_BODY_FONT_ID,
  DEFAULT_BODY_FONT_ID,
  ensureAppearanceBodyFontLoaded,
  isAppearanceBodyFontId,
  type AppearanceBodyFontId,
} from "./appearanceFonts";
import {
  secondaryTextFromInk,
  type StyleBasics,
} from "./styleColorFormula";

export type { StyleBasics };
export type { AppearanceBodyFontId };

const STYLE_ID_KEY = "harvy-style";
const CUSTOM_STYLES_KEY = "harvy:appearance-styles:v1";
const CYBER_STYLE_KEY = "harvy:cyber-style:v1";
const CLASSIC_TYPOGRAPHY_KEY = "harvy:classic-typography:v1";
const LEGACY_THEME_KEY = "harvy-theme";

/** Built-in default style (warm paper / charcoal). */
export const CLASSIC_STYLE_ID = "classic";
/** @deprecated Prefer `CLASSIC_STYLE_ID` — kept for call sites that meant “default style”. */
export const DEFAULT_STYLE_ID = CLASSIC_STYLE_ID;
export const CYBER_STYLE_ID = "cyber";

export type AppearanceStyleId = string;

export type StylePalette = {
  canvas: string;
  panel: string;
  stage: string;
  mist: string;
  page: string;
  ink: string;
  muted: string;
  accent: string;
  line: string;
  focusRing: string;
};

/** Editor body typography stored on custom / cyber styles. */
export type StyleTypography = {
  fontSizePx: number;
  letterSpacingPx: number;
  lineHeight: number;
};

export const DEFAULT_STYLE_TYPOGRAPHY: StyleTypography = {
  fontSizePx: 18,
  letterSpacingPx: 0.2,
  lineHeight: 1.75,
};

export const STYLE_TYPOGRAPHY_LIMITS = {
  fontSizePx: { min: 12, max: 48, step: 0.5 },
  letterSpacingPx: { min: -1.5, max: 6, step: 0.1 },
  lineHeight: { min: 1.1, max: 2.8, step: 0.05 },
} as const;

export type CustomAppearanceStyle = {
  id: string;
  name: string;
  /** Source colors the user picks; light/dark palettes are derived from these. */
  seeds?: StyleBasics;
  light: StylePalette;
  dark: StylePalette;
  /** Body / editor font for this style. */
  bodyFont?: AppearanceBodyFontId;
  /** @deprecated Prefer `bodyFont`. */
  monoContent?: boolean;
  /** Editor body size in CSS pixels. */
  fontSizePx?: number;
  /** Editor body letter-spacing in CSS pixels. */
  letterSpacingPx?: number;
  /** Editor body unitless line-height. */
  lineHeight?: number;
};

function clampTypographyValue(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  const decimals = String(step).includes(".") ? String(step).split(".")[1]!.length : 0;
  const snapped = Math.round(clamped / step) * step;
  return Number(snapped.toFixed(decimals));
}

export function resolveStyleTypography(style: Pick<
  CustomAppearanceStyle,
  "fontSizePx" | "letterSpacingPx" | "lineHeight"
>): StyleTypography {
  return {
    fontSizePx: clampTypographyValue(
      typeof style.fontSizePx === "number" && Number.isFinite(style.fontSizePx)
        ? style.fontSizePx
        : DEFAULT_STYLE_TYPOGRAPHY.fontSizePx,
      STYLE_TYPOGRAPHY_LIMITS.fontSizePx.min,
      STYLE_TYPOGRAPHY_LIMITS.fontSizePx.max,
      STYLE_TYPOGRAPHY_LIMITS.fontSizePx.step,
    ),
    letterSpacingPx: clampTypographyValue(
      typeof style.letterSpacingPx === "number" && Number.isFinite(style.letterSpacingPx)
        ? style.letterSpacingPx
        : DEFAULT_STYLE_TYPOGRAPHY.letterSpacingPx,
      STYLE_TYPOGRAPHY_LIMITS.letterSpacingPx.min,
      STYLE_TYPOGRAPHY_LIMITS.letterSpacingPx.max,
      STYLE_TYPOGRAPHY_LIMITS.letterSpacingPx.step,
    ),
    lineHeight: clampTypographyValue(
      typeof style.lineHeight === "number" && Number.isFinite(style.lineHeight)
        ? style.lineHeight
        : DEFAULT_STYLE_TYPOGRAPHY.lineHeight,
      STYLE_TYPOGRAPHY_LIMITS.lineHeight.min,
      STYLE_TYPOGRAPHY_LIMITS.lineHeight.max,
      STYLE_TYPOGRAPHY_LIMITS.lineHeight.step,
    ),
  };
}

export function resolveStyleBodyFont(style: CustomAppearanceStyle): AppearanceBodyFontId {
  if (isAppearanceBodyFontId(style.bodyFont)) return style.bodyFont;
  if (style.monoContent !== undefined) return bodyFontFromLegacyMono(style.monoContent);
  return style.id === CYBER_STYLE_ID ? CYBER_BODY_FONT_ID : DEFAULT_BODY_FONT_ID;
}

const TOKEN_VARS: Array<[keyof StylePalette, string]> = [
  ["canvas", "--color-canvas"],
  ["panel", "--color-panel"],
  ["stage", "--color-stage"],
  ["mist", "--color-mist"],
  ["page", "--color-page"],
  ["ink", "--color-ink"],
  ["muted", "--color-muted"],
  ["accent", "--color-accent"],
  ["line", "--color-line"],
  ["focusRing", "--color-focus-ring"],
];

export const DEFAULT_LIGHT_PALETTE: StylePalette = {
  canvas: "#faf7f2",
  panel: "#faf7f2",
  stage: "#faf7f2",
  mist: "#f6f2eb",
  page: "#faf7f2",
  ink: "#2a2622",
  muted: "#6e6860",
  accent: "#5f6a7a",
  line: "#e0d8cf",
  focusRing: "#5f6a7a",
};

export const DEFAULT_DARK_PALETTE: StylePalette = {
  canvas: "#121212",
  panel: "#151515",
  stage: "#1a1a1a",
  mist: "#171717",
  page: "#1d1d1d",
  ink: "#e5e5e5",
  muted: "#a1a1a1",
  accent: "#6a7588",
  line: "#ffffff14",
  focusRing: "#6a7588",
};

export const CYBER_LIGHT_PALETTE: StylePalette = {
  canvas: "#f2fbfb",
  panel: "#f2fbfb",
  stage: "#f2fbfb",
  mist: "#e8f7f7",
  page: "#ffffff",
  ink: "#062828",
  muted: "#3a7a7a",
  accent: "#12b0b0",
  line: "#7dfdfe66",
  focusRing: "#12b0b0",
};

export const CYBER_DARK_PALETTE: StylePalette = {
  canvas: "#000707",
  panel: "#000707",
  stage: "#000707",
  mist: "#000c0c",
  page: "#001010",
  ink: "#e8ffff",
  muted: "#7dfdfe",
  accent: "#7dfdfe",
  line: "#7dfdfe33",
  focusRing: "#7dfdfe",
};

export function builtInCyberAppearanceStyle(): CustomAppearanceStyle {
  const seeds: StyleBasics = {
    canvas: CYBER_DARK_PALETTE.canvas,
    ink: CYBER_DARK_PALETTE.ink,
    muted: CYBER_DARK_PALETTE.mist,
    accent: CYBER_DARK_PALETTE.accent,
  };
  return {
    id: CYBER_STYLE_ID,
    name: "Cyber",
    seeds,
    light: { ...CYBER_LIGHT_PALETTE },
    dark: { ...CYBER_DARK_PALETTE },
    bodyFont: CYBER_BODY_FONT_ID,
  };
}

/** Classic shell for the typography editor (colors stay on CSS theme tokens). */
export function builtInClassicAppearanceStyle(): CustomAppearanceStyle {
  return {
    id: CLASSIC_STYLE_ID,
    name: "Classic",
    light: { ...DEFAULT_LIGHT_PALETTE },
    dark: { ...DEFAULT_DARK_PALETTE },
    bodyFont: DEFAULT_BODY_FONT_ID,
    ...readClassicTypography(),
  };
}

export function readClassicTypography(): StyleTypography {
  if (typeof window === "undefined") return { ...DEFAULT_STYLE_TYPOGRAPHY };
  try {
    const raw = window.localStorage.getItem(CLASSIC_TYPOGRAPHY_KEY);
    if (!raw) return { ...DEFAULT_STYLE_TYPOGRAPHY };
    const parsed = JSON.parse(raw) as Partial<StyleTypography>;
    return resolveStyleTypography(parsed);
  } catch {
    return { ...DEFAULT_STYLE_TYPOGRAPHY };
  }
}

export function writeClassicTypography(partial: Partial<StyleTypography>): StyleTypography {
  const next = resolveStyleTypography({ ...readClassicTypography(), ...partial });
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CLASSIC_TYPOGRAPHY_KEY, JSON.stringify(next));
  }
  return next;
}

export function resetClassicTypography(): StyleTypography {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(CLASSIC_TYPOGRAPHY_KEY);
  }
  return { ...DEFAULT_STYLE_TYPOGRAPHY };
}

function isStyleBasics(value: unknown): value is StyleBasics {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.canvas === "string" &&
    typeof v.ink === "string" &&
    typeof v.muted === "string" &&
    typeof v.accent === "string"
  );
}

export function expandPaletteFromBasics(basics: StyleBasics): StylePalette {
  return {
    canvas: basics.canvas,
    panel: basics.canvas,
    stage: basics.canvas,
    // Muted seed → chrome wells (notes, search, tab bar via bg-mist).
    mist: basics.muted,
    page: basics.canvas,
    ink: basics.ink,
    // Secondary text stays readable on mist wells (derived from ink).
    muted: secondaryTextFromInk(basics.ink),
    accent: basics.accent,
    line: basics.accent.length === 7 ? `${basics.accent}33` : basics.accent,
    focusRing: basics.accent,
  };
}

export function palettesFromSeeds(seeds: StyleBasics): {
  light: StylePalette;
  dark: StylePalette;
} {
  // Seeds are the colors you pick — applied as-is (no light/dark HSL remapping).
  const palette = expandPaletteFromBasics(seeds);
  return { light: { ...palette }, dark: { ...palette } };
}

/** Prefer stored seeds; otherwise treat current light palette as seeds. */
export function seedsFromStyle(style: CustomAppearanceStyle): StyleBasics {
  if (style.seeds && isStyleBasics(style.seeds)) {
    return { ...style.seeds };
  }
  return {
    canvas: style.light.canvas,
    ink: style.light.ink,
    muted: style.light.mist,
    accent: style.light.focusRing || style.light.accent,
  };
}

export function styleWithSeeds(
  style: CustomAppearanceStyle,
  seeds: StyleBasics,
): CustomAppearanceStyle {
  const { light, dark } = palettesFromSeeds(seeds);
  return { ...style, seeds: { ...seeds }, light, dark };
}

/** Cyber with any user edits applied (falls back to built-in palettes). */
export function readCyberAppearanceStyle(): CustomAppearanceStyle {
  const defaults = builtInCyberAppearanceStyle();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(CYBER_STYLE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<CustomAppearanceStyle>;
    if (isStyleBasics(parsed.seeds)) {
      const typography = resolveStyleTypography(parsed);
      return styleWithSeeds(
        {
          ...defaults,
          name:
            typeof parsed.name === "string" && parsed.name.trim()
              ? parsed.name.trim()
              : defaults.name,
          bodyFont: isAppearanceBodyFontId(parsed.bodyFont)
            ? parsed.bodyFont
            : bodyFontFromLegacyMono(parsed.monoContent),
          ...typography,
        },
        parsed.seeds,
      );
    }
    if (!isStylePalette(parsed.light) || !isStylePalette(parsed.dark)) return defaults;
    const light = normalizeStylePalette(parsed.light)!;
    const dark = normalizeStylePalette(parsed.dark)!;
    const typography = resolveStyleTypography(parsed);
    return {
      id: CYBER_STYLE_ID,
      name:
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name.trim()
          : "Cyber",
      seeds: {
        canvas: light.canvas,
        ink: light.ink,
        muted: light.mist !== light.canvas ? light.mist : light.muted,
        accent: light.accent,
      },
      light,
      dark,
      bodyFont: isAppearanceBodyFontId(parsed.bodyFont)
        ? parsed.bodyFont
        : bodyFontFromLegacyMono(parsed.monoContent),
      ...typography,
    };
  } catch {
    return defaults;
  }
}

export function writeCyberAppearanceStyle(style: CustomAppearanceStyle) {
  if (typeof window === "undefined") return;
  const seeds = seedsFromStyle(style);
  const next = styleWithSeeds(style, seeds);
  const typography = resolveStyleTypography(next);
  localStorage.setItem(
    CYBER_STYLE_KEY,
    JSON.stringify({
      name: next.name.trim() || "Cyber",
      seeds: next.seeds,
      light: next.light,
      dark: next.dark,
      bodyFont: resolveStyleBodyFont(next),
      ...typography,
    }),
  );
}

/** Restore Cyber to built-in palettes. */
export function resetCyberAppearanceStyle() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CYBER_STYLE_KEY);
}

export function hasCyberAppearanceOverrides(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CYBER_STYLE_KEY) != null;
}

let migratedLegacy = false;

/** One-time: old ThemeMode `"cyber"` → theme dark + style cyber. */
export function migrateLegacyCyberTheme() {
  if (typeof window === "undefined" || migratedLegacy) return;
  migratedLegacy = true;
  try {
    if (localStorage.getItem(LEGACY_THEME_KEY) !== "cyber") return;
    localStorage.setItem(LEGACY_THEME_KEY, "dark");
    if (!localStorage.getItem(STYLE_ID_KEY)) {
      localStorage.setItem(STYLE_ID_KEY, CYBER_STYLE_ID);
    }
  } catch {
    // ignore
  }
}

export function readStoredAppearanceStyleId(): AppearanceStyleId {
  if (typeof window === "undefined") return CLASSIC_STYLE_ID;
  migrateLegacyCyberTheme();
  try {
    const raw = localStorage.getItem(STYLE_ID_KEY);
    // Legacy id from before Classic was named.
    if (!raw || raw === "default" || raw === CLASSIC_STYLE_ID) return CLASSIC_STYLE_ID;
    if (raw === CYBER_STYLE_ID) return CYBER_STYLE_ID;
    const customs = readCustomAppearanceStyles();
    if (customs.some((s) => s.id === raw)) return raw;
    return CLASSIC_STYLE_ID;
  } catch {
    return CLASSIC_STYLE_ID;
  }
}

export function writeStoredAppearanceStyleId(id: AppearanceStyleId) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STYLE_ID_KEY, id);
}

export function readCustomAppearanceStyles(): CustomAppearanceStyle[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_STYLES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      if (!isCustomAppearanceStyle(row)) return [];
      const light = normalizeStylePalette(row.light);
      const dark = normalizeStylePalette(row.dark);
      if (!light || !dark) return [];
      const typography = resolveStyleTypography(row);
      const base = { ...row, light, dark, ...typography };
      if (base.seeds && isStyleBasics(base.seeds)) {
        return [styleWithSeeds(base, base.seeds)];
      }
      return [base];
    });
  } catch {
    return [];
  }
}

function isCustomAppearanceStyle(value: unknown): value is CustomAppearanceStyle {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<CustomAppearanceStyle>;
  return (
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    isStylePalette(s.light) &&
    isStylePalette(s.dark)
  );
}

/** Accept legacy palettes that predate `--color-accent`. */
function normalizeStylePalette(value: unknown): StylePalette | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  const keys = [
    "canvas",
    "panel",
    "stage",
    "mist",
    "page",
    "ink",
    "muted",
    "line",
    "focusRing",
  ] as const;
  if (!keys.every((key) => typeof p[key] === "string")) return null;
  return {
    canvas: p.canvas as string,
    panel: p.panel as string,
    stage: p.stage as string,
    mist: p.mist as string,
    page: p.page as string,
    ink: p.ink as string,
    muted: p.muted as string,
    accent: typeof p.accent === "string" ? p.accent : (p.focusRing as string),
    line: p.line as string,
    focusRing: p.focusRing as string,
  };
}

function isStylePalette(value: unknown): value is StylePalette {
  return normalizeStylePalette(value) != null;
}

export function writeCustomAppearanceStyles(styles: CustomAppearanceStyle[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CUSTOM_STYLES_KEY, JSON.stringify(styles));
}

export function upsertCustomAppearanceStyle(style: CustomAppearanceStyle): CustomAppearanceStyle[] {
  const styles = readCustomAppearanceStyles();
  const index = styles.findIndex((s) => s.id === style.id);
  const next =
    index >= 0
      ? styles.map((s, i) => (i === index ? style : s))
      : [...styles, style];
  writeCustomAppearanceStyles(next);
  return next;
}

export function deleteCustomAppearanceStyle(id: string): CustomAppearanceStyle[] {
  const next = readCustomAppearanceStyles().filter((s) => s.id !== id);
  writeCustomAppearanceStyles(next);
  if (readStoredAppearanceStyleId() === id) {
    writeStoredAppearanceStyleId(CLASSIC_STYLE_ID);
  }
  return next;
}

function seedsFromPalette(palette: StylePalette): StyleBasics {
  return {
    canvas: palette.canvas,
    ink: palette.ink,
    muted: palette.mist,
    accent: palette.focusRing || palette.accent,
  };
}

function palettesMatchForDuplicate(a: StylePalette, b: StylePalette): boolean {
  return (
    a.canvas === b.canvas &&
    a.ink === b.ink &&
    a.mist === b.mist &&
    (a.focusRing || a.accent) === (b.focusRing || b.accent)
  );
}

/**
 * New custom theme cloned from the style currently on screen.
 * Classic / Cyber keep the visible light or dark look; custom themes copy their seeds.
 */
export function duplicateAppearanceStyle(
  source: CustomAppearanceStyle,
  resolvedTheme: ResolvedTheme = "light",
  name = "New theme",
): CustomAppearanceStyle {
  const typography = resolveStyleTypography(source);
  const samePalettes = palettesMatchForDuplicate(source.light, source.dark);
  const seeds =
    source.seeds && isStyleBasics(source.seeds) && samePalettes
      ? { ...source.seeds }
      : seedsFromPalette(resolvedTheme === "dark" ? source.dark : source.light);
  const { light, dark } = palettesFromSeeds(seeds);
  return {
    id: `style-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "New theme",
    seeds,
    light,
    dark,
    bodyFont: resolveStyleBodyFont(source),
    ...typography,
  };
}

export function createBlankCustomStyle(name = "New theme"): CustomAppearanceStyle {
  return duplicateAppearanceStyle(builtInClassicAppearanceStyle(), "light", name);
}

function clearInlineStyleTokens(root: HTMLElement) {
  for (const [, cssVar] of TOKEN_VARS) {
    root.style.removeProperty(cssVar);
  }
  root.style.removeProperty("--font-content");
  root.style.removeProperty("--editor-font-size");
  root.style.removeProperty("--editor-letter-spacing");
  root.style.removeProperty("--editor-line-height");
}

function applyInlineTypography(root: HTMLElement, typography: StyleTypography) {
  root.style.setProperty("--editor-font-size", `${typography.fontSizePx}px`);
  root.style.setProperty("--editor-letter-spacing", `${typography.letterSpacingPx}px`);
  root.style.setProperty("--editor-line-height", String(typography.lineHeight));
}

function applyInlinePalette(
  root: HTMLElement,
  palette: StylePalette,
  bodyFont: AppearanceBodyFontId,
  typography: StyleTypography,
) {
  for (const [key, cssVar] of TOKEN_VARS) {
    root.style.setProperty(cssVar, palette[key]);
  }
  root.style.setProperty("--font-content", appearanceBodyFontStack(bodyFont));
  applyInlineTypography(root, typography);
}

/** In-editor draft; when set, `applyAppearanceStyle` keeps showing this instead of disk. */
let livePreviewStyle: CustomAppearanceStyle | null = null;

/**
 * Live-preview a style draft in the app chrome (not written to storage until Save).
 * Pass `null` to clear the preview lock (caller should re-apply the saved style).
 */
export function setLiveAppearancePreview(
  style: CustomAppearanceStyle | null,
  resolvedTheme: ResolvedTheme,
) {
  livePreviewStyle = style;
  if (style) {
    paintAppearanceStyle(style, resolvedTheme);
  }
}

function paintAppearanceStyle(style: CustomAppearanceStyle, resolvedTheme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const id = style.id || CLASSIC_STYLE_ID;
  const bodyFont = resolveStyleBodyFont(style);
  ensureAppearanceBodyFontLoaded(bodyFont);

  root.dataset.style = id;
  root.classList.toggle("cyber", id === CYBER_STYLE_ID);
  root.classList.toggle(
    "harvy-custom-style",
    id !== CLASSIC_STYLE_ID && id !== CYBER_STYLE_ID,
  );
  root.classList.remove("harvy-mono-content");

  if (id === CLASSIC_STYLE_ID) {
    clearInlineStyleTokens(root);
    applyInlineTypography(root, resolveStyleTypography(style));
    return;
  }

  // Draft / custom / edited cyber: always paint the in-memory palette + body font.
  const palette = resolvedTheme === "dark" ? style.dark : style.light;
  applyInlinePalette(root, palette, bodyFont, resolveStyleTypography(style));
}

/**
 * Apply an appearance style on top of the resolved light/dark theme.
 * Classic uses CSS theme tokens. Cyber uses `.cyber` plus optional saved overrides.
 * Custom styles set CSS variables inline.
 * If a live preview draft is active, that wins until cleared.
 */
export function applyAppearanceStyle(styleId: AppearanceStyleId, resolvedTheme: ResolvedTheme) {
  if (typeof document === "undefined") return;

  if (livePreviewStyle) {
    paintAppearanceStyle(livePreviewStyle, resolvedTheme);
    return;
  }

  const root = document.documentElement;
  const id = styleId || CLASSIC_STYLE_ID;

  root.dataset.style = id;
  root.classList.toggle("cyber", id === CYBER_STYLE_ID);

  if (id === CLASSIC_STYLE_ID) {
    root.classList.remove("harvy-custom-style", "harvy-mono-content");
    clearInlineStyleTokens(root);
    applyInlineTypography(root, readClassicTypography());
    return;
  }

  if (id === CYBER_STYLE_ID) {
    root.classList.remove("harvy-custom-style", "harvy-mono-content");
    const cyber = readCyberAppearanceStyle();
    const bodyFont = resolveStyleBodyFont(cyber);
    ensureAppearanceBodyFontLoaded(bodyFont);
    if (hasCyberAppearanceOverrides()) {
      const palette = resolvedTheme === "dark" ? cyber.dark : cyber.light;
      applyInlinePalette(root, palette, bodyFont, resolveStyleTypography(cyber));
    } else {
      clearInlineStyleTokens(root);
      root.style.setProperty("--font-content", appearanceBodyFontStack(bodyFont));
    }
    return;
  }

  const custom = readCustomAppearanceStyles().find((s) => s.id === id);
  if (!custom) {
    clearInlineStyleTokens(root);
    root.dataset.style = CLASSIC_STYLE_ID;
    root.classList.remove("harvy-custom-style", "harvy-mono-content", "cyber");
    return;
  }

  root.classList.add("harvy-custom-style");
  root.classList.remove("harvy-mono-content");
  const bodyFont = resolveStyleBodyFont(custom);
  ensureAppearanceBodyFontLoaded(bodyFont);
  const palette = resolvedTheme === "dark" ? custom.dark : custom.light;
  applyInlinePalette(root, palette, bodyFont, resolveStyleTypography(custom));
}

/** Stage RGB for native Notes window chrome. */
export function stageBackgroundRgb(
  resolvedTheme: ResolvedTheme,
  styleId: AppearanceStyleId,
): [number, number, number] {
  if (styleId === CYBER_STYLE_ID) {
    const cyber = readCyberAppearanceStyle();
    const hex = resolvedTheme === "dark" ? cyber.dark.stage : cyber.light.stage;
    return hexToRgb(hex) ?? (resolvedTheme === "dark" ? [0, 7, 7] : [242, 251, 251]);
  }
  if (styleId !== CLASSIC_STYLE_ID) {
    const custom = readCustomAppearanceStyles().find((s) => s.id === styleId);
    if (custom) {
      const hex = resolvedTheme === "dark" ? custom.dark.stage : custom.light.stage;
      const rgb = hexToRgb(hex);
      if (rgb) return rgb;
    }
  }
  return resolvedTheme === "dark" ? [26, 26, 26] : [250, 247, 242];
}

function hexToRgb(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace("#", "");
  if (raw.length === 3) {
    const r = Number.parseInt(raw[0]! + raw[0]!, 16);
    const g = Number.parseInt(raw[1]! + raw[1]!, 16);
    const b = Number.parseInt(raw[2]! + raw[2]!, 16);
    if ([r, g, b].some((n) => !Number.isFinite(n))) return null;
    return [r, g, b];
  }
  if (raw.length !== 6) return null;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((n) => !Number.isFinite(n))) return null;
  return [r, g, b];
}
