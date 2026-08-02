const STORAGE_SHOW_QUICK_LINKS = "harvy:show-quick-links";

export type QuickLinksSettings = {
  /** When on, Quick Links appears below Notes in the right sidebar. */
  showQuickLinks: boolean;
};

const defaultSettings: QuickLinksSettings = {
  showQuickLinks: false,
};

export function readQuickLinksSettings(): QuickLinksSettings {
  if (typeof window === "undefined") return { ...defaultSettings };
  return {
    showQuickLinks: localStorage.getItem(STORAGE_SHOW_QUICK_LINKS) === "true",
  };
}

export function writeQuickLinksSettings(
  partial: Partial<QuickLinksSettings>,
): QuickLinksSettings {
  const next = { ...readQuickLinksSettings(), ...partial };
  if (typeof window !== "undefined" && partial.showQuickLinks !== undefined) {
    localStorage.setItem(STORAGE_SHOW_QUICK_LINKS, next.showQuickLinks ? "true" : "false");
  }
  return next;
}
