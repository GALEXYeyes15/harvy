/** User-added Google Fonts for the appearance body-font catalog. */

export const USER_APPEARANCE_FONTS_KEY = "harvy:user-appearance-fonts:v1";

export type GoogleFontCategory =
  | "Serif"
  | "Sans Serif"
  | "Display"
  | "Handwriting"
  | "Monospace";

export type UserAppearanceFont = {
  id: string;
  /** Exact Google Fonts family name (e.g. "Playfair Display"). */
  family: string;
  label: string;
  category: GoogleFontCategory | string;
};

function fallbackStack(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes("mono")) {
    return 'ui-monospace, "Cascadia Code", "SF Mono", Menlo, monospace';
  }
  if (lower.includes("serif") && !lower.includes("sans")) {
    return 'Georgia, "Times New Roman", serif';
  }
  return 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
}

export function slugifyFontFamily(family: string): string {
  return family
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function userFontToOption(font: UserAppearanceFont): {
  id: string;
  label: string;
  stack: string;
  googleFamily: string;
  userAdded: true;
} {
  return {
    id: font.id,
    label: font.label,
    googleFamily: font.family,
    userAdded: true,
    stack: `"${font.family}", ${fallbackStack(font.category)}`,
  };
}

export function googleFontsCssUrl(family: string): string {
  const param = family.trim().replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${param}:ital,wght@0,400;0,600;1,400&display=swap`;
}

const loadedFamilies = new Set<string>();

/** Inject a Google Fonts stylesheet for a family (idempotent). */
export function ensureGoogleFontStylesheet(family: string): void {
  if (typeof document === "undefined") return;
  const trimmed = family.trim();
  if (!trimmed || loadedFamilies.has(trimmed.toLowerCase())) return;

  const href = googleFontsCssUrl(trimmed);
  const existing = document.querySelector<HTMLLinkElement>(
    `link[data-harvy-google-font="${CSS.escape(trimmed)}"]`,
  );
  if (existing) {
    loadedFamilies.add(trimmed.toLowerCase());
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.harvyGoogleFont = trimmed;
  document.head.appendChild(link);
  loadedFamilies.add(trimmed.toLowerCase());
}

function isUserFont(value: unknown): value is UserAppearanceFont {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    typeof row.family === "string" &&
    row.family.length > 0 &&
    typeof row.label === "string" &&
    typeof row.category === "string"
  );
}

export function readUserAppearanceFonts(): UserAppearanceFont[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_APPEARANCE_FONTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: UserAppearanceFont[] = [];
    for (const row of parsed) {
      if (!isUserFont(row)) continue;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push({
        id: row.id,
        family: row.family,
        label: row.label || row.family,
        category: row.category,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function writeUserAppearanceFonts(fonts: UserAppearanceFont[]): void {
  localStorage.setItem(USER_APPEARANCE_FONTS_KEY, JSON.stringify(fonts));
}

/** Apply a catalog snapshot from another window (Tauri sync). */
export function writeUserAppearanceFontsFromSync(fonts: UserAppearanceFont[]): void {
  if (typeof window === "undefined") return;
  const normalized = fonts.filter(
    (row) =>
      typeof row?.id === "string" &&
      row.id &&
      typeof row.family === "string" &&
      row.family,
  );
  writeUserAppearanceFonts(normalized);
}

export function isUserFontAdded(familyOrId: string): boolean {
  const needle = familyOrId.trim().toLowerCase();
  return readUserAppearanceFonts().some(
    (font) => font.id === needle || font.family.toLowerCase() === needle,
  );
}

export function addUserAppearanceFont(input: {
  family: string;
  category: string;
  label?: string;
}): UserAppearanceFont {
  const family = input.family.trim();
  const id = slugifyFontFamily(family);
  if (!id) throw new Error("Invalid font family");

  const next: UserAppearanceFont = {
    id,
    family,
    label: (input.label ?? family).trim() || family,
    category: input.category || "Sans Serif",
  };

  const existing = readUserAppearanceFonts();
  if (existing.some((font) => font.id === next.id)) {
    return existing.find((font) => font.id === next.id)!;
  }

  writeUserAppearanceFonts([...existing, next]);
  ensureGoogleFontStylesheet(next.family);
  return next;
}

export function removeUserAppearanceFont(id: string): void {
  writeUserAppearanceFonts(readUserAppearanceFonts().filter((font) => font.id !== id));
}
