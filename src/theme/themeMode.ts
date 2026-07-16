export type ThemeMode = "light" | "dark" | "system" | "cyber";

export type ResolvedTheme = "light" | "dark" | "cyber";

const STORAGE_KEY = "harvy-theme";

export function readStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system" || v === "cyber") return v;
  return "system";
}

export function writeStoredThemeMode(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, mode);
}

export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === "light") return "light";
  if (mode === "dark") return "dark";
  if (mode === "cyber") return "cyber";
  return systemPrefersDark ? "dark" : "light";
}

/** Apply resolved theme classes / data attributes on `<html>`. */
export function applyResolvedTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle("dark", resolved === "dark" || resolved === "cyber");
  root.classList.toggle("cyber", resolved === "cyber");
}

/** Restore the last-used theme before React paints (avoids a light/dark flash). */
export function bootStoredTheme() {
  if (typeof window === "undefined") return;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyResolvedTheme(resolveTheme(readStoredThemeMode(), systemDark));
}
