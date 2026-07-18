export type SettingsSectionId =
  | "general"
  | "appearance"
  | "editor"
  | "shortcuts"
  | "encouragement"
  | "files"
  | "about";

export const SETTINGS_NAV: { id: SettingsSectionId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "editor", label: "Editor" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "encouragement", label: "Encouragement" },
  { id: "files", label: "Files" },
  { id: "about", label: "About" },
];
