export type SettingsSectionId =
  | "editor"
  | "sidebars"
  | "collect"
  | "appearance"
  | "encouragement"
  | "shortcuts"
  | "about";

export const SETTINGS_NAV: { id: SettingsSectionId; label: string }[] = [
  { id: "editor", label: "Editor" },
  { id: "sidebars", label: "Sidebars" },
  { id: "collect", label: "Collect" },
  { id: "appearance", label: "Appearance" },
  { id: "encouragement", label: "Encouragement" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "about", label: "About" },
];
