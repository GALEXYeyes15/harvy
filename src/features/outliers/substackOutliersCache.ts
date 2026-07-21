import type { SubstackPostResult } from "./fetchSubstackOutliers";

const STORAGE_KEY = "harvy:outliers-substack-cache:v4";

/** Fallback soft TTL when no interval is passed (matches default fetch interval). */
export const SUBSTACK_OUTLIERS_CACHE_TTL_MS = 5 * 60 * 1000;

export type SubstackOutliersCacheEntry = {
  accountUrl: string;
  fetchedAt: number;
  results: SubstackPostResult[];
};

type CacheStore = {
  byAccountUrl: Record<string, SubstackOutliersCacheEntry>;
};

export function normalizeSubstackAccountUrl(accountUrl: string): string {
  return accountUrl.trim().replace(/\/+$/, "").toLowerCase();
}

function readStore(): CacheStore {
  if (typeof localStorage === "undefined") return { byAccountUrl: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { byAccountUrl: {} };
    const parsed = JSON.parse(raw) as Partial<CacheStore>;
    if (!parsed || typeof parsed !== "object" || !parsed.byAccountUrl) {
      return { byAccountUrl: {} };
    }
    return { byAccountUrl: parsed.byAccountUrl };
  } catch {
    return { byAccountUrl: {} };
  }
}

function writeStore(store: CacheStore): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota or private mode — ignore; network fetch still works when available.
  }
}

export function readSubstackOutliersCache(
  accountUrl: string,
): SubstackOutliersCacheEntry | null {
  const key = normalizeSubstackAccountUrl(accountUrl);
  if (!key) return null;
  const entry = readStore().byAccountUrl[key];
  if (!entry || !Array.isArray(entry.results)) return null;
  return entry;
}

/** True when a background network refresh is unnecessary for the given TTL. */
export function isSubstackOutliersCacheFresh(
  entry: SubstackOutliersCacheEntry,
  nowMs = Date.now(),
  ttlMs = SUBSTACK_OUTLIERS_CACHE_TTL_MS,
): boolean {
  return nowMs - entry.fetchedAt < ttlMs;
}

export function writeSubstackOutliersCache(
  accountUrl: string,
  results: SubstackPostResult[],
  fetchedAt = Date.now(),
): void {
  const key = normalizeSubstackAccountUrl(accountUrl);
  if (!key) return;
  const store = readStore();
  store.byAccountUrl[key] = {
    accountUrl: accountUrl.trim(),
    fetchedAt,
    results,
  };
  writeStore(store);
}
