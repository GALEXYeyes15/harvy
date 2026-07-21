export type SettingsSectionId =
  | "general"
  | "appearance"
  | "editor"
  | "parameters"
  | "shortcuts"
  | "encouragement"
  | "files"
  | "about";

export const SETTINGS_NAV: { id: SettingsSectionId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "editor", label: "Editor" },
  { id: "appearance", label: "Appearance" },
  { id: "parameters", label: "Parameters" },
  { id: "encouragement", label: "Encouragement" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "files", label: "Files" },
  { id: "about", label: "About" },
];
