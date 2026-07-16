export type SettingsSectionId =
  | "general"
  | "appearance"
  | "editor"
  | "encouragement"
  | "files"
  | "about";

export const SETTINGS_NAV: { id: SettingsSectionId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "editor", label: "Editor" },
  { id: "encouragement", label: "Encouragement" },
  { id: "files", label: "Files" },
  { id: "about", label: "About" },
];
