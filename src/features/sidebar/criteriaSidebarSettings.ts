const STORAGE_SHOW_CRITERIA = "harvy:show-criteria-sidebar";
const STORAGE_PUBLISH_URL = "harvy:criteria-publish-url";

export type CriteriaSidebarSettings = {
  /** When on, Criteria appears as a tab in the right tools rail (Write). */
  showCriteria: boolean;
  /** Destination opened by Publish after copying the current post. */
  publishUrl: string;
};

const defaultSettings: CriteriaSidebarSettings = {
  showCriteria: true,
  publishUrl: "",
};

export function readCriteriaSidebarSettings(): CriteriaSidebarSettings {
  if (typeof window === "undefined") return { ...defaultSettings };
  const rawShow = localStorage.getItem(STORAGE_SHOW_CRITERIA);
  const rawUrl = localStorage.getItem(STORAGE_PUBLISH_URL);
  return {
    showCriteria: rawShow === null ? defaultSettings.showCriteria : rawShow === "true",
    publishUrl: rawUrl ?? defaultSettings.publishUrl,
  };
}

export function writeCriteriaSidebarSettings(
  partial: Partial<CriteriaSidebarSettings>,
): CriteriaSidebarSettings {
  const next = { ...readCriteriaSidebarSettings(), ...partial };
  if (typeof window !== "undefined") {
    if (partial.showCriteria !== undefined) {
      localStorage.setItem(STORAGE_SHOW_CRITERIA, next.showCriteria ? "true" : "false");
    }
    if (partial.publishUrl !== undefined) {
      localStorage.setItem(STORAGE_PUBLISH_URL, next.publishUrl);
    }
  }
  return next;
}
