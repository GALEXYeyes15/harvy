import type { ResolvedTheme } from "./themeMode";
import {
  deriveBasicsFromSeeds,
  type StyleBasics,
} from "./styleColorFormula";

export type { StyleBasics };

const STYLE_ID_KEY = "harvy-style";
const CUSTOM_STYLES_KEY = "harvy:appearance-styles:v1";
const CYBER_STYLE_KEY = "harvy:cyber-style:v1";
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
  line: string;
  focusRing: string;
};

export type CustomAppearanceStyle = {
  id: string;
  name: string;
  /** Source colors the user picks; light/dark palettes are derived from these. */
  seeds?: StyleBasics;
  light: StylePalette;
  dark: StylePalette;
  /** When true, editor/notes use mono like Cyber. */
  monoContent?: boolean;
};

export type BuiltinStyleId = typeof CLASSIC_STYLE_ID | typeof CYBER_STYLE_ID;

const TOKEN_VARS: Array<[keyof StylePalette, string]> = [
  ["canvas", "--color-canvas"],
  ["panel", "--color-panel"],
  ["stage", "--color-stage"],
  ["mist", "--color-mist"],
  ["page", "--color-page"],
  ["ink", "--color-ink"],
  ["muted", "--color-muted"],
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
  line: "#7dfdfe33",
  focusRing: "#7dfdfe",
};

/** Seed palette for new custom styles (light). */
export const NEW_STYLE_LIGHT_PALETTE: StylePalette = { ...DEFAULT_LIGHT_PALETTE };

/** Seed palette for new custom styles (dark). */
export const NEW_STYLE_DARK_PALETTE: StylePalette = { ...DEFAULT_DARK_PALETTE };

export function builtInCyberAppearanceStyle(): CustomAppearanceStyle {
  const seeds: StyleBasics = {
    canvas: "#03daff",
    ink: "#0a2a2a",
    muted: "#2a6a6a",
    accent: "#7dfdfe",
  };
  const { light, dark } = palettesFromSeeds(seeds);
  return {
    id: CYBER_STYLE_ID,
    name: "Cyber",
    seeds,
    light,
    dark,
    monoContent: true,
  };
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
    mist: basics.canvas,
    page: basics.canvas,
    ink: basics.ink,
    muted: basics.muted,
    line: basics.accent.length === 7 ? `${basics.accent}33` : basics.accent,
    focusRing: basics.accent,
  };
}

export function palettesFromSeeds(seeds: StyleBasics): {
  light: StylePalette;
  dark: StylePalette;
} {
  const derived = deriveBasicsFromSeeds(seeds);
  return {
    light: expandPaletteFromBasics(derived.light),
    dark: expandPaletteFromBasics(derived.dark),
  };
}

/** Prefer stored seeds; otherwise treat current light palette as seeds. */
export function seedsFromStyle(style: CustomAppearanceStyle): StyleBasics {
  if (style.seeds && isStyleBasics(style.seeds)) {
    return { ...style.seeds };
  }
  return {
    canvas: style.light.canvas,
    ink: style.light.ink,
    muted: style.light.muted,
    accent: style.light.focusRing,
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
      return styleWithSeeds({ ...defaults, monoContent: parsed.monoContent !== false }, parsed.seeds);
    }
    if (!isStylePalette(parsed.light) || !isStylePalette(parsed.dark)) return defaults;
    return {
      id: CYBER_STYLE_ID,
      name: "Cyber",
      seeds: {
        canvas: parsed.light.canvas,
        ink: parsed.light.ink,
        muted: parsed.light.muted,
        accent: parsed.light.focusRing,
      },
      light: parsed.light,
      dark: parsed.dark,
      monoContent: parsed.monoContent !== false,
    };
  } catch {
    return defaults;
  }
}

export function writeCyberAppearanceStyle(style: CustomAppearanceStyle) {
  if (typeof window === "undefined") return;
  const seeds = seedsFromStyle(style);
  const next = styleWithSeeds(style, seeds);
  localStorage.setItem(
    CYBER_STYLE_KEY,
    JSON.stringify({
      seeds: next.seeds,
      light: next.light,
      dark: next.dark,
      monoContent: Boolean(next.monoContent),
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
    return parsed.filter(isCustomAppearanceStyle);
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

function isStylePalette(value: unknown): value is StylePalette {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return TOKEN_VARS.every(([key]) => typeof p[key] === "string");
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

export function createBlankCustomStyle(name = "New style"): CustomAppearanceStyle {
  const seeds: StyleBasics = {
    canvas: NEW_STYLE_LIGHT_PALETTE.canvas,
    ink: NEW_STYLE_LIGHT_PALETTE.ink,
    muted: NEW_STYLE_LIGHT_PALETTE.muted,
    accent: NEW_STYLE_LIGHT_PALETTE.focusRing,
  };
  const { light, dark } = palettesFromSeeds(seeds);
  return {
    id: `style-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "New style",
    seeds,
    light,
    dark,
    monoContent: false,
  };
}

function clearInlineStyleTokens(root: HTMLElement) {
  for (const [, cssVar] of TOKEN_VARS) {
    root.style.removeProperty(cssVar);
  }
  root.style.removeProperty("--font-content");
}

function applyInlinePalette(root: HTMLElement, palette: StylePalette, monoContent: boolean) {
  for (const [key, cssVar] of TOKEN_VARS) {
    root.style.setProperty(cssVar, palette[key]);
  }
  if (monoContent) {
    root.style.setProperty(
      "--font-content",
      '"IBM Plex Mono", ui-monospace, "Cascadia Code", "SF Mono", Menlo, monospace',
    );
  } else {
    root.style.removeProperty("--font-content");
  }
}

/**
 * Apply an appearance style on top of the resolved light/dark theme.
 * Classic uses CSS theme tokens. Cyber uses `.cyber` plus optional saved overrides.
 * Custom styles set CSS variables inline.
 */
export function applyAppearanceStyle(styleId: AppearanceStyleId, resolvedTheme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const id = styleId || CLASSIC_STYLE_ID;

  root.dataset.style = id;
  root.classList.toggle("cyber", id === CYBER_STYLE_ID);

  if (id === CLASSIC_STYLE_ID) {
    root.classList.remove("harvy-custom-style", "harvy-mono-content");
    clearInlineStyleTokens(root);
    return;
  }

  if (id === CYBER_STYLE_ID) {
    root.classList.remove("harvy-custom-style");
    const cyber = readCyberAppearanceStyle();
    root.classList.toggle("harvy-mono-content", Boolean(cyber.monoContent));
    if (hasCyberAppearanceOverrides()) {
      const palette = resolvedTheme === "dark" ? cyber.dark : cyber.light;
      applyInlinePalette(root, palette, Boolean(cyber.monoContent));
    } else {
      clearInlineStyleTokens(root);
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
  root.classList.toggle("harvy-mono-content", Boolean(custom.monoContent));
  const palette = resolvedTheme === "dark" ? custom.dark : custom.light;
  applyInlinePalette(root, palette, Boolean(custom.monoContent));
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
