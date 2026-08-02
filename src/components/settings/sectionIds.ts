export type SettingsSectionId =
  | "general"
  | "appearance"
  | "editor"
  | "quickLinks"
  | "outliers"
  | "parameters"
  | "shortcuts"
  | "encouragement"
  | "files"
  | "about";

export const SETTINGS_NAV: { id: SettingsSectionId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "editor", label: "Editor" },
  { id: "quickLinks", label: "Quick Links" },
  { id: "outliers", label: "Outliers" },
  { id: "appearance", label: "Appearance" },
  { id: "parameters", label: "Parameters" },
  { id: "encouragement", label: "Encouragement" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "files", label: "Files" },
  { id: "about", label: "About" },
];
