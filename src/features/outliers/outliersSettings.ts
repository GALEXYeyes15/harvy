import { DEFAULT_SUBSTACK_ACCOUNT_URL } from "./fetchSubstackOutliers";
import {
  createOutlierSource,
  defaultLabelForOutlierSource,
  type OutlierSource,
} from "./outlierSources";
import {
  DEFAULT_CONTENT_TYPE_FILTER,
  type ContentTypeFilter,
  type OutlierScoreFilter,
  type PostedWithinFilter,
} from "./outlierPosts";

const STORAGE_KEY = "harvy:outliers-settings:v2";
const LEGACY_STORAGE_KEY = "harvy:outliers-settings:v1";

/** Fired on `window` after Outliers settings that affect auto-refresh are written. */
export const OUTLIERS_SETTINGS_CHANGED_EVENT = "harvy:outliers-settings-changed";

export const DEFAULT_OUTLIERS_FETCH_INTERVAL_MINUTES = 5;
export const OUTLIERS_FETCH_INTERVAL_MIN_MINUTES = 1;
export const OUTLIERS_FETCH_INTERVAL_MAX_MINUTES = 240;

export type OutliersSettings = {
  sources: OutlierSource[];
  contentType: ContentTypeFilter;
  outlierScore: OutlierScoreFilter;
  postedWithin: PostedWithinFilter;
  fetchIntervalMinutes: number;
  autoFetchEnabled: boolean;
  autoRefreshArmed: boolean;
};

const defaultSources = (): OutlierSource[] => [
  createOutlierSource({
    platform: "substack",
    url: DEFAULT_SUBSTACK_ACCOUNT_URL,
  }),
];

const defaultSettings: OutliersSettings = {
  sources: defaultSources(),
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

function parseContentType(raw: unknown): ContentTypeFilter {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_CONTENT_TYPE_FILTER };
  }
  const value = raw as Partial<ContentTypeFilter>;
  const showNotes = value.showNotes !== false;
  const showPosts = value.showPosts === true;
  if (!showNotes && !showPosts) {
    return { ...DEFAULT_CONTENT_TYPE_FILTER };
  }
  return { showNotes, showPosts };
}

function parseSources(raw: unknown): OutlierSource[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultSources();
  const parsed: OutlierSource[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<OutlierSource>;
    if (
      typeof row.id !== "string" ||
      typeof row.url !== "string" ||
      !row.url.trim() ||
      (row.platform !== "substack" && row.platform !== "medium" && row.platform !== "youtube") ||
      (row.kind !== "account" && row.kind !== "feed")
    ) {
      continue;
    }
    parsed.push({
      id: row.id,
      platform: row.platform,
      kind: "account",
      url: row.url.trim(),
      label: defaultLabelForOutlierSource(row.platform, row.url.trim()),
    });
  }
  return parsed.length > 0 ? parsed : defaultSources();
}

function migrateLegacySettings(): OutliersSettings | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OutliersSettings & { accountLink?: string }>;
    const accountLink =
      typeof parsed.accountLink === "string" && parsed.accountLink.trim()
        ? parsed.accountLink.trim()
        : DEFAULT_SUBSTACK_ACCOUNT_URL;
    const sources = [
      createOutlierSource({
        platform: "substack",
        url: accountLink,
      }),
    ];
    return {
      sources,
      contentType: parseContentType(parsed.contentType),
      outlierScore: SCORE_FILTERS.has(parsed.outlierScore as OutlierScoreFilter)
        ? (parsed.outlierScore as OutlierScoreFilter)
        : defaultSettings.outlierScore,
      postedWithin: POSTED_WITHIN_FILTERS.has(parsed.postedWithin as PostedWithinFilter)
        ? (parsed.postedWithin as PostedWithinFilter)
        : defaultSettings.postedWithin,
      fetchIntervalMinutes: clampOutliersFetchIntervalMinutes(parsed.fetchIntervalMinutes),
      autoFetchEnabled: parsed.autoFetchEnabled !== false,
      autoRefreshArmed: parsed.autoRefreshArmed === true,
    };
  } catch {
    return null;
  }
}

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

export function readOutliersSettings(): OutliersSettings {
  if (typeof localStorage === "undefined") {
    return {
      ...defaultSettings,
      sources: defaultSources(),
      contentType: { ...defaultSettings.contentType },
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const migrated = migrateLegacySettings();
      if (migrated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      return {
        ...defaultSettings,
        sources: defaultSources(),
        contentType: { ...defaultSettings.contentType },
      };
    }
    const parsed = JSON.parse(raw) as Partial<OutliersSettings>;
    return {
      sources: parseSources(parsed.sources),
      contentType: parseContentType(parsed.contentType),
      outlierScore: SCORE_FILTERS.has(parsed.outlierScore as OutlierScoreFilter)
        ? (parsed.outlierScore as OutlierScoreFilter)
        : defaultSettings.outlierScore,
      postedWithin: POSTED_WITHIN_FILTERS.has(parsed.postedWithin as PostedWithinFilter)
        ? (parsed.postedWithin as PostedWithinFilter)
        : defaultSettings.postedWithin,
      fetchIntervalMinutes: clampOutliersFetchIntervalMinutes(parsed.fetchIntervalMinutes),
      autoFetchEnabled: parsed.autoFetchEnabled !== false,
      autoRefreshArmed: parsed.autoRefreshArmed === true,
    };
  } catch {
    return {
      ...defaultSettings,
      sources: defaultSources(),
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
  if (!autoFetchEnabled) {
    autoRefreshArmed = false;
  }

  const next: OutliersSettings = {
    ...current,
    ...partial,
    sources: partial.sources ? parseSources(partial.sources) : current.sources,
    contentType: partial.contentType
      ? parseContentType(partial.contentType)
      : current.contentType,
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
      // Quota / private mode
    }
  }

  const sourcesChanged =
    partial.sources !== undefined &&
    JSON.stringify(next.sources) !== JSON.stringify(current.sources);
  const refreshScheduleChanged =
    (partial.fetchIntervalMinutes !== undefined &&
      next.fetchIntervalMinutes !== current.fetchIntervalMinutes) ||
    (partial.autoFetchEnabled !== undefined &&
      next.autoFetchEnabled !== current.autoFetchEnabled) ||
    (partial.autoRefreshArmed !== undefined &&
      next.autoRefreshArmed !== current.autoRefreshArmed) ||
    (!autoFetchEnabled && current.autoRefreshArmed) ||
    sourcesChanged;

  if (refreshScheduleChanged && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OUTLIERS_SETTINGS_CHANGED_EVENT));
  }

  return next;
}

/** @deprecated Use `sources` — kept for cache migration reads. */
export function readLegacyAccountLink(): string | null {
  const settings = readOutliersSettings();
  const substack = settings.sources.find((s) => s.platform === "substack");
  return substack?.url ?? null;
}
