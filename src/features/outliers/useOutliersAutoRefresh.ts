import { useEffect } from "react";
import { fetchSubstackOutlierPosts } from "./fetchSubstackOutliers";
import {
  OUTLIERS_SETTINGS_CHANGED_EVENT,
  outliersFetchIntervalMs,
  readOutliersSettings,
} from "./outliersSettings";
import { readSubstackOutliersCache } from "./substackOutliersCache";

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

    const runFetch = async (url: string) => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await fetchSubstackOutlierPosts(url, { forceRefresh: true });
        if (cancelled || !result.refreshed) return;
        window.dispatchEvent(
          new CustomEvent(OUTLIERS_CACHE_UPDATED_EVENT, {
            detail: { accountUrl: url },
          }),
        );
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
      if (!settings.autoRefreshArmed) return;
      const url = settings.accountLink.trim();
      if (!url) return;

      const intervalMs = outliersFetchIntervalMs(settings.fetchIntervalMinutes);
      const lastFetchedAt = readSubstackOutliersCache(url)?.fetchedAt ?? null;
      const delay = msUntilNextOutliersRefresh(lastFetchedAt, intervalMs);

      timerId = window.setTimeout(() => {
        void (async () => {
          if (cancelled) return;
          const latest = readOutliersSettings();
          if (!latest.autoRefreshArmed) return;
          const latestUrl = latest.accountLink.trim();
          if (!latestUrl) return;
          await runFetch(latestUrl);
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
