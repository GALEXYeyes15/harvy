/** Body / content fonts available to appearance styles. */

import {
  ensureGoogleFontStylesheet,
  readUserAppearanceFonts,
  USER_APPEARANCE_FONTS_KEY,
  userFontToOption,
  type UserAppearanceFont,
} from "./userAppearanceFonts";

export type BuiltinAppearanceBodyFontId =
  | "libre-baskerville"
  | "source-serif"
  | "literata"
  | "crimson-pro"
  | "inter"
  | "space-grotesk"
  | "ibm-plex-mono"
  | "jetbrains-mono";

/** Built-in id or a user-added Google Font slug. */
export type AppearanceBodyFontId = BuiltinAppearanceBodyFontId | (string & {});

export type AppearanceBodyFontOption = {
  id: AppearanceBodyFontId;
  label: string;
  /** CSS font-family stack written to `--font-content`. */
  stack: string;
  /** Google Fonts family name when loaded from the CDN (built-ins use index.html). */
  googleFamily?: string;
  /** True when the user added this font from Google Fonts. */
  userAdded?: boolean;
};

export const APPEARANCE_BODY_FONTS: AppearanceBodyFontOption[] = [
  {
    id: "libre-baskerville",
    label: "Libre Baskerville",
    stack:
      '"Libre Baskerville", "Baskerville", "Baskerville Old Face", Palatino, "Palatino Linotype", Georgia, serif',
    googleFamily: "Libre Baskerville",
  },
  {
    id: "source-serif",
    label: "Source Serif",
    stack: '"Source Serif 4", "Source Serif Pro", Georgia, "Times New Roman", serif',
    googleFamily: "Source Serif 4",
  },
  {
    id: "literata",
    label: "Literata",
    stack: '"Literata", Georgia, "Times New Roman", serif',
    googleFamily: "Literata",
  },
  {
    id: "crimson-pro",
    label: "Crimson Pro",
    stack: '"Crimson Pro", Georgia, "Times New Roman", serif',
    googleFamily: "Crimson Pro",
  },
  {
    id: "inter",
    label: "Inter",
    stack: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    googleFamily: "Inter",
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    stack: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    googleFamily: "Space Grotesk",
  },
  {
    id: "ibm-plex-mono",
    label: "IBM Plex Mono",
    stack: '"IBM Plex Mono", ui-monospace, "Cascadia Code", "SF Mono", Menlo, monospace',
    googleFamily: "IBM Plex Mono",
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    stack: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
    googleFamily: "JetBrains Mono",
  },
];

export const DEFAULT_BODY_FONT_ID: AppearanceBodyFontId = "libre-baskerville";
export const CYBER_BODY_FONT_ID: AppearanceBodyFontId = "ibm-plex-mono";

export const APPEARANCE_FONTS_CHANGED_EVENT = "harvy-appearance-fonts-changed";

const BUILTIN_BY_ID = new Map(APPEARANCE_BODY_FONTS.map((font) => [font.id, font]));
const BUILTIN_BY_FAMILY = new Map(
  APPEARANCE_BODY_FONTS.filter((f) => f.googleFamily).map((f) => [
    f.googleFamily!.toLowerCase(),
    f,
  ]),
);

function catalogMap(): Map<string, AppearanceBodyFontOption> {
  const map = new Map<string, AppearanceBodyFontOption>(BUILTIN_BY_ID);
  for (const user of readUserAppearanceFonts()) {
    map.set(user.id, userFontToOption(user));
  }
  return map;
}

/** Built-ins first, then user-added fonts alphabetically. */
export function listAppearanceBodyFonts(): AppearanceBodyFontOption[] {
  const user = readUserAppearanceFonts()
    .map(userFontToOption)
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...APPEARANCE_BODY_FONTS, ...user];
}

export function isAppearanceBodyFontId(value: unknown): value is AppearanceBodyFontId {
  if (typeof value !== "string" || !value) return false;
  return catalogMap().has(value);
}

export function resolveAppearanceBodyFont(
  id: AppearanceBodyFontId | null | undefined,
): AppearanceBodyFontOption {
  const map = catalogMap();
  return map.get(id ?? DEFAULT_BODY_FONT_ID) ?? APPEARANCE_BODY_FONTS[0]!;
}

export function appearanceBodyFontStack(
  id: AppearanceBodyFontId | null | undefined,
): string {
  return resolveAppearanceBodyFont(id).stack;
}

/** Ensure the face for this catalog id is available (no-op for built-ins in index.html). */
export function ensureAppearanceBodyFontLoaded(
  id: AppearanceBodyFontId | null | undefined,
): void {
  const font = resolveAppearanceBodyFont(id);
  if (font.googleFamily && font.userAdded) {
    ensureGoogleFontStylesheet(font.googleFamily);
  }
}

/** Load stylesheets for every user-added font (call on boot). */
export function ensureAllUserAppearanceFontsLoaded(): void {
  for (const font of readUserAppearanceFonts()) {
    ensureGoogleFontStylesheet(font.family);
  }
}

export function findBuiltinFontByGoogleFamily(
  family: string,
): AppearanceBodyFontOption | undefined {
  return BUILTIN_BY_FAMILY.get(family.trim().toLowerCase());
}

export function notifyAppearanceFontsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(APPEARANCE_FONTS_CHANGED_EVENT));
}

export function isUserAppearanceFontsStorageKey(key: string | null): boolean {
  return key === USER_APPEARANCE_FONTS_KEY;
}

/** Migrate legacy `monoContent` boolean into a body font id. */
export function bodyFontFromLegacyMono(monoContent: unknown): AppearanceBodyFontId {
  return monoContent === true ? CYBER_BODY_FONT_ID : DEFAULT_BODY_FONT_ID;
}

export type { UserAppearanceFont };
