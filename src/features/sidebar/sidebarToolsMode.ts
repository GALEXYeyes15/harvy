export const SIDEBAR_TOOLS_MODES = ["notes", "edit"] as const;

export type SidebarToolsMode = (typeof SIDEBAR_TOOLS_MODES)[number];
