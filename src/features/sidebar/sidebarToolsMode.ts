export const SIDEBAR_TOOLS_MODES = ["notes", "edit"] as const;

export type SidebarToolsMode = (typeof SIDEBAR_TOOLS_MODES)[number];

/** Tabs shown in the right tools rail for Write. */
export const WRITE_SIDEBAR_TOOLS_MODES = SIDEBAR_TOOLS_MODES;

/** Collect only shows Notes (no tool tabs). */
export function isSidebarModeForSection(
  mode: SidebarToolsMode,
  section: "collect" | "write",
): boolean {
  if (section === "collect") {
    return mode === "notes";
  }
  return (WRITE_SIDEBAR_TOOLS_MODES as readonly SidebarToolsMode[]).includes(mode);
}
