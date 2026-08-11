import { DEFAULT_SUBSTACK_ACCOUNT_URL } from "./fetchSubstackOutliers";
import {
  DEFAULT_CONTENT_TYPE_FILTER,
  type ContentTypeFilter,
  type OutlierScoreFilter,
  type PostedWithinFilter,
} from "./outlierPosts";

const STORAGE_KEY = "harvy:outliers-settings:v1";

/** Fired on `window` after Outliers settings that affect auto-refresh are written. */
export const OUTLIERS_SETTINGS_CHANGED_EVENT = "harvy:outliers-settings-changed";

export const DEFAULT_OUTLIERS_FETCH_INTERVAL_MINUTES = 5;
export const OUTLIERS_FETCH_INTERVAL_MIN_MINUTES = 1;
export const OUTLIERS_FETCH_INTERVAL_MAX_MINUTES = 240;

export type OutliersSettings = {
  accountLink: string;
  contentType: ContentTypeFilter;
  outlierScore: OutlierScoreFilter;
  postedWithin: PostedWithinFilter;
  /** Minutes between automatic refreshes after an explicit Fetch posts. */
  fetchIntervalMinutes: number;
  /**
   * Master switch: when false, never schedule background refreshes
   * (and clear any armed schedule).
   */
  autoFetchEnabled: boolean;
  /**
   * After the user clicks Fetch posts (and auto-fetch is enabled), keep refreshing
   * on the fetch interval until the account link changes or they turn auto-fetch off.
   */
  autoRefreshArmed: boolean;
};

const defaultSettings: OutliersSettings = {
  accountLink: DEFAULT_SUBSTACK_ACCOUNT_URL,
  contentType: { ...DEFAULT_CONTENT_TYPE_FILTER },
  outlierScore: "any",
  postedWithin: "year",
  fetchIntervalMinutes: DEFAULT_OUTLIERS_FETCH_INTERVAL_MINUTES,
  autoFetchEnabled: true,
  autoRefreshArmed: false,
};

const SCORE_FILTERS = new Set<OutlierScoreFilter>(["any", "3x", "5x", "10x", "20x"]);
const POSTED_WITHIN_FILTERS = new Set<PostedWithinFilter>([
  "week",
  "month",
  "3months",
  "year",
]);

export function clampOutliersFetchIntervalMinutes(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_OUTLIERS_FETCH_INTERVAL_MINUTES;
  return Math.min(
    OUTLIERS_FETCH_INTERVAL_MAX_MINUTES,
    Math.max(OUTLIERS_FETCH_INTERVAL_MIN_MINUTES, Math.round(n)),
  );
}

export function outliersFetchIntervalMs(
  minutes: number = readOutliersSettings().fetchIntervalMinutes,
): number {
  return clampOutliersFetchIntervalMinutes(minutes) * 60_000;
}

function parseContentType(raw: unknown): ContentTypeFilter {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_CONTENT_TYPE_FILTER };
  }
  const value = raw as Partial<ContentTypeFilter>;
  const showNotes = value.showNotes !== false;
  const showPosts = value.showPosts === true;
  // At least one must stay on.
  if (!showNotes && !showPosts) {
    return { ...DEFAULT_CONTENT_TYPE_FILTER };
  }
  return { showNotes, showPosts };
}

export function readOutliersSettings(): OutliersSettings {
  if (typeof localStorage === "undefined") {
    return {
      ...defaultSettings,
      contentType: { ...defaultSettings.contentType },
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...defaultSettings,
        contentType: { ...defaultSettings.contentType },
      };
    }
    const parsed = JSON.parse(raw) as Partial<OutliersSettings>;
    const accountLink =
      typeof parsed.accountLink === "string" && parsed.accountLink.trim()
        ? parsed.accountLink.trim()
        : defaultSettings.accountLink;
    const outlierScore = SCORE_FILTERS.has(parsed.outlierScore as OutlierScoreFilter)
      ? (parsed.outlierScore as OutlierScoreFilter)
      : defaultSettings.outlierScore;
    const postedWithin = POSTED_WITHIN_FILTERS.has(
      parsed.postedWithin as PostedWithinFilter,
    )
      ? (parsed.postedWithin as PostedWithinFilter)
      : defaultSettings.postedWithin;

    return {
      accountLink,
      contentType: parseContentType(parsed.contentType),
      outlierScore,
      postedWithin,
      fetchIntervalMinutes: clampOutliersFetchIntervalMinutes(parsed.fetchIntervalMinutes),
      autoFetchEnabled: parsed.autoFetchEnabled !== false,
      autoRefreshArmed: parsed.autoRefreshArmed === true,
    };
  } catch {
    return {
      ...defaultSettings,
      contentType: { ...defaultSettings.contentType },
    };
  }
}

export function writeOutliersSettings(partial: Partial<OutliersSettings>): OutliersSettings {
  const current = readOutliersSettings();
  const autoFetchEnabled =
    partial.autoFetchEnabled !== undefined
      ? Boolean(partial.autoFetchEnabled)
      : current.autoFetchEnabled;
  let autoRefreshArmed =
    partial.autoRefreshArmed !== undefined
      ? Boolean(partial.autoRefreshArmed)
      : current.autoRefreshArmed;
  // Turning off the master switch always disarms the schedule.
  if (!autoFetchEnabled) {
    autoRefreshArmed = false;
  }

  const next: OutliersSettings = {
    ...current,
    ...partial,
    contentType: partial.contentType
      ? parseContentType(partial.contentType)
      : current.contentType,
    accountLink:
      partial.accountLink !== undefined
        ? partial.accountLink.trim() || defaultSettings.accountLink
        : current.accountLink,
    fetchIntervalMinutes:
      partial.fetchIntervalMinutes !== undefined
        ? clampOutliersFetchIntervalMinutes(partial.fetchIntervalMinutes)
        : current.fetchIntervalMinutes,
    autoFetchEnabled,
    autoRefreshArmed,
  };

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota / private mode — keep in-memory next for this session.
    }
  }

  const refreshScheduleChanged =
    (partial.fetchIntervalMinutes !== undefined &&
      next.fetchIntervalMinutes !== current.fetchIntervalMinutes) ||
    (partial.autoFetchEnabled !== undefined &&
      next.autoFetchEnabled !== current.autoFetchEnabled) ||
    (partial.autoRefreshArmed !== undefined &&
      next.autoRefreshArmed !== current.autoRefreshArmed) ||
    (!autoFetchEnabled && current.autoRefreshArmed) ||
    (partial.accountLink !== undefined && next.accountLink !== current.accountLink);

  if (refreshScheduleChanged && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OUTLIERS_SETTINGS_CHANGED_EVENT));
  }

  return next;
}
