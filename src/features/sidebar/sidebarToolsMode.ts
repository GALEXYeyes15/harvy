export const SIDEBAR_TOOLS_MODES = ["outline", "edit"] as const;

export type SidebarToolsMode = (typeof SIDEBAR_TOOLS_MODES)[number];
