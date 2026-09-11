import { useEffect } from "react";
import { fetchAllOutlierPosts } from "./fetchOutlierPosts";
import {
  OUTLIERS_SETTINGS_CHANGED_EVENT,
  outliersFetchIntervalMs,
  readOutliersSettings,
} from "./outliersSettings";
import { outliersCacheKey, readOutliersCacheEntry } from "./outliersCache";

/** Fired after a successful auto-refresh writes the Outliers cache. */
export const OUTLIERS_CACHE_UPDATED_EVENT = "harvy:outliers-cache-updated";

/** Delay until the next refresh based on last fetch time and the configured interval. */
export function msUntilNextOutliersRefresh(
  lastFetchedAt: number | null | undefined,
  intervalMs: number,
  nowMs = Date.now(),
): number {
  if (lastFetchedAt == null || lastFetchedAt <= 0 || intervalMs <= 0) return 0;
  return Math.max(0, intervalMs - (nowMs - lastFetchedAt));
}

function latestFetchedAtForSources(): number | null {
  const settings = readOutliersSettings();
  let latest: number | null = null;
  for (const source of settings.sources) {
    const key = outliersCacheKey(source.id, source.platform, source.url);
    const entry = readOutliersCacheEntry(key);
    if (!entry) continue;
    if (latest == null || entry.fetchedAt > latest) latest = entry.fetchedAt;
  }
  return latest;
}

/**
 * Keeps Outliers posts refreshing on the configured interval after Fetch posts,
 * even when the Outliers tab is not mounted (Ideas / Avatar / Write).
 */
export function useOutliersAutoRefresh(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let cancelled = false;
    let timerId: number | null = null;
    let inFlight = false;

    const clearTimer = () => {
      if (timerId == null) return;
      window.clearTimeout(timerId);
      timerId = null;
    };

    const runFetch = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const settings = readOutliersSettings();
        const result = await fetchAllOutlierPosts(settings.sources, { forceRefresh: true });
        if (cancelled || !result.refreshedAny) return;
        window.dispatchEvent(new CustomEvent(OUTLIERS_CACHE_UPDATED_EVENT));
      } catch {
        // Keep the schedule; next tick retries. Cache stays as-is.
      } finally {
        inFlight = false;
      }
    };

    const schedule = () => {
      clearTimer();
      if (cancelled) return;

      const settings = readOutliersSettings();
      if (!settings.autoFetchEnabled || !settings.autoRefreshArmed) return;
      if (settings.sources.length === 0) return;

      const intervalMs = outliersFetchIntervalMs(settings.fetchIntervalMinutes);
      const lastFetchedAt = latestFetchedAtForSources();
      const delay = msUntilNextOutliersRefresh(lastFetchedAt, intervalMs);

      timerId = window.setTimeout(() => {
        void (async () => {
          if (cancelled) return;
          const latest = readOutliersSettings();
          if (!latest.autoFetchEnabled || !latest.autoRefreshArmed) return;
          if (latest.sources.length === 0) return;
          await runFetch();
          if (!cancelled) schedule();
        })();
      }, delay);
    };

    schedule();
    window.addEventListener(OUTLIERS_SETTINGS_CHANGED_EVENT, schedule);
    return () => {
      cancelled = true;
      clearTimer();
      window.removeEventListener(OUTLIERS_SETTINGS_CHANGED_EVENT, schedule);
    };
  }, [enabled]);
}
