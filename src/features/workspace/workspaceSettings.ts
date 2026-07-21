const STORAGE_ENABLE_COLLECT = "harvy:enable-collect";
const STORAGE_SHOW_OUTLIERS_VIEW = "harvy:show-outliers-view";
const STORAGE_SHOW_COLLECT_VIEW = "harvy:show-collect-view";

export type WorkspaceSettings = {
  enableCollect: boolean;
  /** Outliers sub-view inside Collect. */
  showOutliersView: boolean;
  /** Collect table sub-view inside Collect. */
  showCollectView: boolean;
};

const defaultSettings: WorkspaceSettings = {
  enableCollect: true,
  showOutliersView: true,
  showCollectView: true,
};

function readBool(key: string, defaultValue: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  return raw !== "false";
}

/**
 * Apply a Collect sub-view visibility change.
 * Rejects updates that would leave both views off (keeps the previous state).
 */
export function applyCollectSubViewVisibility(
  current: Pick<WorkspaceSettings, "showOutliersView" | "showCollectView">,
  partial: Partial<Pick<WorkspaceSettings, "showOutliersView" | "showCollectView">>,
): Pick<WorkspaceSettings, "showOutliersView" | "showCollectView"> {
  const next = { ...current, ...partial };
  if (!next.showOutliersView && !next.showCollectView) {
    return current;
  }
  return next;
}

export function readWorkspaceSettings(): WorkspaceSettings {
  if (typeof window === "undefined") return { ...defaultSettings };

  const visibility = applyCollectSubViewVisibility(defaultSettings, {
    showOutliersView: readBool(STORAGE_SHOW_OUTLIERS_VIEW, true),
    showCollectView: readBool(STORAGE_SHOW_COLLECT_VIEW, true),
  });

  // Corrupted storage with both off → restore defaults.
  const safeVisibility =
    !visibility.showOutliersView && !visibility.showCollectView
      ? {
          showOutliersView: defaultSettings.showOutliersView,
          showCollectView: defaultSettings.showCollectView,
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

  if (partial.showOutliersView !== undefined || partial.showCollectView !== undefined) {
    next = {
      ...next,
      ...applyCollectSubViewVisibility(current, {
        showOutliersView: next.showOutliersView,
        showCollectView: next.showCollectView,
      }),
    };
  }

  if (typeof window !== "undefined") {
    if (partial.enableCollect !== undefined) {
      localStorage.setItem(STORAGE_ENABLE_COLLECT, next.enableCollect ? "true" : "false");
    }
    if (partial.showOutliersView !== undefined || partial.showCollectView !== undefined) {
      localStorage.setItem(STORAGE_SHOW_OUTLIERS_VIEW, next.showOutliersView ? "true" : "false");
      localStorage.setItem(STORAGE_SHOW_COLLECT_VIEW, next.showCollectView ? "true" : "false");
    }
  }
  return next;
}
