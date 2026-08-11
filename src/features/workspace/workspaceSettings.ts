const STORAGE_ENABLE_COLLECT = "harvy:enable-collect";
const STORAGE_SHOW_OUTLIERS_VIEW = "harvy:show-outliers-view";
const STORAGE_SHOW_COLLECT_VIEW = "harvy:show-collect-view";
const STORAGE_SHOW_AVATAR_VIEW = "harvy:show-avatar-view";

export type CollectSubViewVisibility = {
  showOutliersView: boolean;
  showCollectView: boolean;
  showAvatarView: boolean;
};

export type WorkspaceSettings = {
  enableCollect: boolean;
} & CollectSubViewVisibility;

const defaultSettings: WorkspaceSettings = {
  enableCollect: true,
  showOutliersView: true,
  showCollectView: true,
  showAvatarView: true,
};

function readBool(key: string, defaultValue: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  return raw !== "false";
}

function countEnabledViews(views: CollectSubViewVisibility): number {
  return (
    Number(views.showOutliersView) +
    Number(views.showCollectView) +
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
  if (typeof window === "undefined") return { ...defaultSettings };

  const visibility = applyCollectSubViewVisibility(defaultSettings, {
    showOutliersView: readBool(STORAGE_SHOW_OUTLIERS_VIEW, true),
    showCollectView: readBool(STORAGE_SHOW_COLLECT_VIEW, true),
    showAvatarView: readBool(STORAGE_SHOW_AVATAR_VIEW, true),
  });

  const safeVisibility =
    countEnabledViews(visibility) === 0
      ? {
          showOutliersView: defaultSettings.showOutliersView,
          showCollectView: defaultSettings.showCollectView,
          showAvatarView: defaultSettings.showAvatarView,
        }
      : visibility;

  return {
    enableCollect: localStorage.getItem(STORAGE_ENABLE_COLLECT) !== "false",
    ...safeVisibility,
  };
}

export function writeWorkspaceSettings(partial: Partial<WorkspaceSettings>): WorkspaceSettings {
  const current = readWorkspaceSettings();
  let next: WorkspaceSettings = { ...current, ...partial };

  if (
    partial.showOutliersView !== undefined ||
    partial.showCollectView !== undefined ||
    partial.showAvatarView !== undefined
  ) {
    next = {
      ...next,
      ...applyCollectSubViewVisibility(current, {
        showOutliersView: next.showOutliersView,
        showCollectView: next.showCollectView,
        showAvatarView: next.showAvatarView,
      }),
    };
  }

  if (typeof window !== "undefined") {
    if (partial.enableCollect !== undefined) {
      localStorage.setItem(STORAGE_ENABLE_COLLECT, next.enableCollect ? "true" : "false");
    }
    if (
      partial.showOutliersView !== undefined ||
      partial.showCollectView !== undefined ||
      partial.showAvatarView !== undefined
    ) {
      localStorage.setItem(STORAGE_SHOW_OUTLIERS_VIEW, next.showOutliersView ? "true" : "false");
      localStorage.setItem(STORAGE_SHOW_COLLECT_VIEW, next.showCollectView ? "true" : "false");
      localStorage.setItem(STORAGE_SHOW_AVATAR_VIEW, next.showAvatarView ? "true" : "false");
    }
  }
  return next;
}
