/** Left file sidebar width (matches AppShell overlay rail). */
export const WORKSPACE_SIDEBAR_WIDTH_PX = 260;

/** Right tools / Notes sidebar width (matches AppShell overlay rail). */
export const TOOLS_SIDEBAR_WIDTH_PX = 300;

/** Collect / Write switcher column width (3.25rem). */
export const WORKSPACE_SECTION_SWITCHER_WIDTH_PX = 52;

export type WorkspaceSection = "collect" | "write";

export const WORKSPACE_SECTIONS: WorkspaceSection[] = ["collect", "write"];

export const WORKSPACE_SECTION_LABELS: Record<WorkspaceSection, string> = {
  collect: "Collect",
  write: "Write",
};

/** Left-rail label for Collect — “Outliers” when that’s the only Collect view enabled. */
export function workspaceSectionLabel(
  section: WorkspaceSection,
  views?: { showOutliersView: boolean; showCollectView: boolean },
): string {
  if (
    section === "collect" &&
    views &&
    views.showOutliersView &&
    !views.showCollectView
  ) {
    return "Outliers";
  }
  return WORKSPACE_SECTION_LABELS[section];
}

/** Left-rail sections visible for the current workspace settings. */
export function visibleWorkspaceSections(enableCollect: boolean): WorkspaceSection[] {
  return enableCollect ? WORKSPACE_SECTIONS : ["write"];
}
