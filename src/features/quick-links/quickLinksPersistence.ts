import {
  normalizeQuickLink,
  parsePersistedQuickLinks,
  type QuickLink,
} from "./quickLinks";

const STORAGE_KEY = "harvy:quick-links";
export const QUICK_LINKS_CHANGED_EVENT = "harvy:quick-links-changed";

export function loadPersistedQuickLinks(): QuickLink[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return parsePersistedQuickLinks(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function savePersistedQuickLinks(links: QuickLink[]): void {
  if (typeof localStorage === "undefined") return;
  const normalized = links.map(normalizeQuickLink);
  const raw = JSON.stringify(normalized);
  if (localStorage.getItem(STORAGE_KEY) === raw) return;
  localStorage.setItem(STORAGE_KEY, raw);
  window.dispatchEvent(new CustomEvent(QUICK_LINKS_CHANGED_EVENT));
}
