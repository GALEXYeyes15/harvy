const STORAGE_SHOW_CRITERIA = "harvy:show-criteria-sidebar";
const STORAGE_PUBLISH_URL = "harvy:criteria-publish-url";
const STORAGE_ESSAYS_ARCHIVE_URL = "harvy:essays-archive-url";

export type CriteriaSidebarSettings = {
  /** When on, Criteria appears as a tab in the right tools rail (Write). */
  showCriteria: boolean;
  /** Destination opened by Publish after copying the current post. */
  publishUrl: string;
  /** Your Substack (or site) URL used to match published essay links. */
  essaysArchiveUrl: string;
};

const defaultSettings: CriteriaSidebarSettings = {
  showCriteria: true,
  publishUrl: "",
  essaysArchiveUrl: "",
};

export function readCriteriaSidebarSettings(): CriteriaSidebarSettings {
  if (typeof window === "undefined") return { ...defaultSettings };
  const rawShow = localStorage.getItem(STORAGE_SHOW_CRITERIA);
  const rawUrl = localStorage.getItem(STORAGE_PUBLISH_URL);
  const rawArchive = localStorage.getItem(STORAGE_ESSAYS_ARCHIVE_URL);
  return {
    showCriteria: rawShow === null ? defaultSettings.showCriteria : rawShow === "true",
    publishUrl: rawUrl ?? defaultSettings.publishUrl,
    essaysArchiveUrl: rawArchive ?? defaultSettings.essaysArchiveUrl,
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
    if (partial.essaysArchiveUrl !== undefined) {
      localStorage.setItem(STORAGE_ESSAYS_ARCHIVE_URL, next.essaysArchiveUrl);
    }
  }
  return next;
}
