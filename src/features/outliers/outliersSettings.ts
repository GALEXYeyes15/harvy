import { DEFAULT_SUBSTACK_ACCOUNT_URL } from "./fetchSubstackOutliers";
import {
  DEFAULT_CONTENT_TYPE_FILTER,
  type ContentTypeFilter,
  type OutlierScoreFilter,
  type PostedWithinFilter,
} from "./outlierPosts";

const STORAGE_KEY = "harvy:outliers-settings:v1";

export type OutliersSettings = {
  accountLink: string;
  contentType: ContentTypeFilter;
  outlierScore: OutlierScoreFilter;
  postedWithin: PostedWithinFilter;
};

const defaultSettings: OutliersSettings = {
  accountLink: DEFAULT_SUBSTACK_ACCOUNT_URL,
  contentType: { ...DEFAULT_CONTENT_TYPE_FILTER },
  outlierScore: "any",
  postedWithin: "year",
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
  };

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Quota / private mode — keep in-memory next for this session.
    }
  }
  return next;
}
