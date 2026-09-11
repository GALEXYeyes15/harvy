export type SettingsSectionId =
  | "editor"
  | "sidebars"
  | "ai"
  | "export"
  | "collect"
  | "appearance"
  | "encouragement"
  | "shortcuts"
  | "about";

export const SETTINGS_NAV: { id: SettingsSectionId; label: string }[] = [
  { id: "editor", label: "Editor" },
  { id: "sidebars", label: "Sidebars" },
  { id: "ai", label: "Artificial Intelligence" },
  { id: "export", label: "Export" },
  { id: "collect", label: "Research" },
  { id: "appearance", label: "Appearance" },
  { id: "encouragement", label: "Encouragement" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "about", label: "About" },
];
