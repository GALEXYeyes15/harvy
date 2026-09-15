const STORAGE_SHOW_MECHANICS = "harvy:show-mechanics-sidebar";

export type MechanicsSidebarSettings = {
  /** When on, Spellings / Grammar / Suggestions / AI Check run in Edit. */
  showMechanics: boolean;
};

const defaultSettings: MechanicsSidebarSettings = {
  showMechanics: true,
};

export function readMechanicsSidebarSettings(): MechanicsSidebarSettings {
  if (typeof window === "undefined") return { ...defaultSettings };
  const rawShow = localStorage.getItem(STORAGE_SHOW_MECHANICS);
  return {
    showMechanics: rawShow === null ? defaultSettings.showMechanics : rawShow === "true",
  };
}

export function writeMechanicsSidebarSettings(
  partial: Partial<MechanicsSidebarSettings>,
): MechanicsSidebarSettings {
  const next = { ...readMechanicsSidebarSettings(), ...partial };
  if (typeof window !== "undefined" && partial.showMechanics !== undefined) {
    localStorage.setItem(STORAGE_SHOW_MECHANICS, next.showMechanics ? "true" : "false");
  }
  return next;
}
