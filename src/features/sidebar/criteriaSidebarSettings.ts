const STORAGE_SHOW_CRITERIA = "harvy:show-criteria-sidebar";

export type CriteriaSidebarSettings = {
  /** When on, Criteria appears as a tab in the right tools rail (Write). */
  showCriteria: boolean;
};

const defaultSettings: CriteriaSidebarSettings = {
  showCriteria: true,
};

export function readCriteriaSidebarSettings(): CriteriaSidebarSettings {
  if (typeof window === "undefined") return { ...defaultSettings };
  const raw = localStorage.getItem(STORAGE_SHOW_CRITERIA);
  if (raw === null) return { ...defaultSettings };
  return {
    showCriteria: raw === "true",
  };
}

export function writeCriteriaSidebarSettings(
  partial: Partial<CriteriaSidebarSettings>,
): CriteriaSidebarSettings {
  const next = { ...readCriteriaSidebarSettings(), ...partial };
  if (typeof window !== "undefined" && partial.showCriteria !== undefined) {
    localStorage.setItem(STORAGE_SHOW_CRITERIA, next.showCriteria ? "true" : "false");
  }
  return next;
}
