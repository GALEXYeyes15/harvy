import type { OutlierPlatform } from "./outlierSources";

const STORAGE_KEY = "harvy:outliers-cache:v1";

export const OUTLIERS_CACHE_TTL_MS = 5 * 60 * 1000;

/** Platform-specific raw payloads stored before scoring. */
export type OutliersCachePayload = {
  substack?: unknown[];
  medium?: unknown[];
  youtube?: unknown[];
};

export type OutliersCacheEntry = {
  sourceId: string;
  platform: OutlierPlatform;
  sourceUrl: string;
  fetchedAt: number;
  results: OutliersCachePayload;
};

type CacheStore = {
  bySourceKey: Record<string, OutliersCacheEntry>;
};

export function outliersCacheKey(sourceId: string, platform: OutlierPlatform, sourceUrl: string): string {
  return `${platform}:${sourceId}:${sourceUrl.trim().replace(/\/+$/, "").toLowerCase()}`;
}

function readStore(): CacheStore {
  if (typeof localStorage === "undefined") return { bySourceKey: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bySourceKey: {} };
    const parsed = JSON.parse(raw) as Partial<CacheStore>;
    if (!parsed?.bySourceKey || typeof parsed.bySourceKey !== "object") {
      return { bySourceKey: {} };
    }
    return { bySourceKey: parsed.bySourceKey };
  } catch {
    return { bySourceKey: {} };
  }
}

function writeStore(store: CacheStore): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota / private mode
  }
}

export function readOutliersCacheEntry(key: string): OutliersCacheEntry | null {
  if (!key) return null;
  const entry = readStore().bySourceKey[key];
  if (!entry?.results) return null;
  return entry;
}

export function isOutliersCacheFresh(
  entry: OutliersCacheEntry,
  nowMs = Date.now(),
  ttlMs = OUTLIERS_CACHE_TTL_MS,
): boolean {
  return nowMs - entry.fetchedAt < ttlMs;
}

export function writeOutliersCacheEntry(
  key: string,
  entry: Omit<OutliersCacheEntry, "fetchedAt"> & { fetchedAt?: number },
): void {
  if (!key) return;
  const store = readStore();
  store.bySourceKey[key] = {
    ...entry,
    fetchedAt: entry.fetchedAt ?? Date.now(),
  };
  writeStore(store);
}

export function removeOutliersCacheForSource(sourceId: string): void {
  const store = readStore();
  let changed = false;
  for (const key of Object.keys(store.bySourceKey)) {
    if (store.bySourceKey[key]?.sourceId === sourceId) {
      delete store.bySourceKey[key];
      changed = true;
    }
  }
  if (changed) writeStore(store);
}

/** Latest fetch time across all cached sources (for “last fetched” label). */
export function latestOutliersCacheFetchedAt(keys: string[]): number | null {
  let latest: number | null = null;
  for (const key of keys) {
    const entry = readOutliersCacheEntry(key);
    if (!entry) continue;
    if (latest == null || entry.fetchedAt > latest) latest = entry.fetchedAt;
  }
  return latest;
}
