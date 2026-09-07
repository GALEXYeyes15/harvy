import {
  COLLECT_SUB_VIEWS,
  normalizeCollectViewOrder,
  type CollectSubView,
} from "./collectViews";

const STORAGE_ENABLE_COLLECT = "harvy:enable-collect";
const STORAGE_SHOW_OUTLIERS_VIEW = "harvy:show-outliers-view";
const STORAGE_SHOW_COLLECT_VIEW = "harvy:show-collect-view";
const STORAGE_SHOW_HEADLINES_VIEW = "harvy:show-headlines-view";
const STORAGE_SHOW_AVATAR_VIEW = "harvy:show-avatar-view";
const STORAGE_COLLECT_VIEW_ORDER = "harvy:collect-view-order";

export type CollectSubViewVisibility = {
  showOutliersView: boolean;
  showCollectView: boolean;
  showHeadlinesView: boolean;
  showAvatarView: boolean;
};

export type WorkspaceSettings = {
  enableCollect: boolean;
  collectViewOrder: CollectSubView[];
} & CollectSubViewVisibility;

const defaultSettings: WorkspaceSettings = {
  enableCollect: true,
  showOutliersView: true,
  showCollectView: true,
  showHeadlinesView: true,
  showAvatarView: true,
  collectViewOrder: [...COLLECT_SUB_VIEWS],
};

function readBool(key: string, defaultValue: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  return raw !== "false";
}

function readCollectViewOrder(): CollectSubView[] {
  const raw = localStorage.getItem(STORAGE_COLLECT_VIEW_ORDER);
  if (!raw) return [...COLLECT_SUB_VIEWS];
  try {
    const parsed: unknown = JSON.parse(raw);
    return normalizeCollectViewOrder(Array.isArray(parsed) ? parsed : null);
  } catch {
    return [...COLLECT_SUB_VIEWS];
  }
}

function countEnabledViews(views: CollectSubViewVisibility): number {
  return (
    Number(views.showOutliersView) +
    Number(views.showCollectView) +
    Number(views.showHeadlinesView) +
    Number(views.showAvatarView)
  );
}

/**
 * Apply a Collect sub-view visibility change.
 * Rejects updates that would leave every view off (keeps the previous state).
 */
export function applyCollectSubViewVisibility(
  current: CollectSubViewVisibility,
  partial: Partial<CollectSubViewVisibility>,
): CollectSubViewVisibility {
  const next = { ...current, ...partial };
  if (countEnabledViews(next) === 0) {
    return current;
  }
  return next;
}

export function readWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === "undefined") return { ...defaultSettings, collectViewOrder: [...COLLECT_SUB_VIEWS] };

  const visibility = applyCollectSubViewVisibility(defaultSettings, {
    showOutliersView: readBool(STORAGE_SHOW_OUTLIERS_VIEW, true),
    showCollectView: readBool(STORAGE_SHOW_COLLECT_VIEW, true),
    showHeadlinesView: readBool(STORAGE_SHOW_HEADLINES_VIEW, true),
    showAvatarView: readBool(STORAGE_SHOW_AVATAR_VIEW, true),
  });

  const safeVisibility =
    countEnabledViews(visibility) === 0
      ? {
          showOutliersView: defaultSettings.showOutliersView,
          showCollectView: defaultSettings.showCollectView,
          showHeadlinesView: defaultSettings.showHeadlinesView,
          showAvatarView: defaultSettings.showAvatarView,
        }
      : visibility;

  return {
    enableCollect: localStorage.getItem(STORAGE_ENABLE_COLLECT) !== "false",
    collectViewOrder: readCollectViewOrder(),
    ...safeVisibility,
  };
}

export function writeWorkspaceSettings(partial: Partial<WorkspaceSettings>): WorkspaceSettings {
  const current = readWorkspaceSettings();
  let next: WorkspaceSettings = { ...current, ...partial };

  if (
    partial.showOutliersView !== undefined ||
    partial.showCollectView !== undefined ||
    partial.showHeadlinesView !== undefined ||
    partial.showAvatarView !== undefined
  ) {
    next = {
      ...next,
      ...applyCollectSubViewVisibility(current, {
        showOutliersView: next.showOutliersView,
        showCollectView: next.showCollectView,
        showHeadlinesView: next.showHeadlinesView,
        showAvatarView: next.showAvatarView,
      }),
    };
  }

  if (partial.collectViewOrder !== undefined) {
    next = { ...next, collectViewOrder: normalizeCollectViewOrder(partial.collectViewOrder) };
  }

  if (typeof window !== "undefined") {
    if (partial.enableCollect !== undefined) {
      localStorage.setItem(STORAGE_ENABLE_COLLECT, next.enableCollect ? "true" : "false");
    }
    if (
      partial.showOutliersView !== undefined ||
      partial.showCollectView !== undefined ||
      partial.showHeadlinesView !== undefined ||
      partial.showAvatarView !== undefined
    ) {
      localStorage.setItem(STORAGE_SHOW_OUTLIERS_VIEW, next.showOutliersView ? "true" : "false");
      localStorage.setItem(STORAGE_SHOW_COLLECT_VIEW, next.showCollectView ? "true" : "false");
      localStorage.setItem(STORAGE_SHOW_HEADLINES_VIEW, next.showHeadlinesView ? "true" : "false");
      localStorage.setItem(STORAGE_SHOW_AVATAR_VIEW, next.showAvatarView ? "true" : "false");
    }
    if (partial.collectViewOrder !== undefined) {
      localStorage.setItem(STORAGE_COLLECT_VIEW_ORDER, JSON.stringify(next.collectViewOrder));
    }
  }
  return next;
}
