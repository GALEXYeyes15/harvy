import {
  normalizeCollectItem,
  parsePersistedCollectItems,
  type CollectItem,
} from "./collectItems";

const STORAGE_KEY = "harvy:collect-items";

export function loadPersistedCollectItems(): CollectItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return parsePersistedCollectItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function savePersistedCollectItems(items: CollectItem[]): void {
  if (typeof localStorage === "undefined") return;
  const normalized = items.map(normalizeCollectItem);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}
