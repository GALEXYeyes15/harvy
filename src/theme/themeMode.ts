import {
  applyAppearanceStyle,
  migrateLegacyCyberTheme,
  readStoredAppearanceStyleId,
} from "./appearanceStyles";

export type ThemeMode = "light" | "dark" | "system";

export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "harvy-theme";

export function readStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  migrateLegacyCyberTheme();
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

export function writeStoredThemeMode(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
}

export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}

/** Apply light/dark classes. Style layer is applied via `applyAppearanceStyle`. */
export function applyResolvedTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle("dark", resolved === "dark");
}

/** Restore theme + style before React paints (avoids a light/dark flash). */
export function bootStoredTheme() {
  if (typeof window === "undefined") return;
  migrateLegacyCyberTheme();
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = resolveTheme(readStoredThemeMode(), systemDark);
  applyResolvedTheme(resolved);
  applyAppearanceStyle(readStoredAppearanceStyleId(), resolved);
}
