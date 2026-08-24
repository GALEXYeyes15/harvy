export const SIDEBAR_TOOLS_MODES = ["notes", "edit", "criteria"] as const;

export type SidebarToolsMode = (typeof SIDEBAR_TOOLS_MODES)[number];

/** Tabs that can appear in the right tools rail for Write (visibility may be filtered). */
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

/** Visible Write tabs after applying Settings (e.g. Criteria toggle). */
export function visibleWriteSidebarModes(opts: {
  showCriteria: boolean;
}): SidebarToolsMode[] {
  return WRITE_SIDEBAR_TOOLS_MODES.filter((mode) => {
    if (mode === "criteria") return opts.showCriteria;
    return true;
  });
}
