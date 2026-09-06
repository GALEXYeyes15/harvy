/** Left file sidebar width (matches AppShell overlay rail). */
export const WORKSPACE_SIDEBAR_WIDTH_PX = 260;

/** Right tools / Notes sidebar width (matches AppShell overlay rail). */
export const TOOLS_SIDEBAR_WIDTH_PX = 300;

/** Research / Write switcher column width (3.25rem). */
export const WORKSPACE_SECTION_SWITCHER_WIDTH_PX = 52;

export type WorkspaceSection = "collect" | "write";

export const WORKSPACE_SECTIONS: WorkspaceSection[] = ["collect", "write"];

export const WORKSPACE_SECTION_LABELS: Record<WorkspaceSection, string> = {
  collect: "Research",
  write: "Write",
};

/** Left-rail label for Research — use the sole enabled sub-view name when only one is on. */
export function workspaceSectionLabel(
  section: WorkspaceSection,
  views?: {
    showOutliersView: boolean;
    showCollectView: boolean;
    showHeadlinesView: boolean;
    showAvatarView: boolean;
  },
): string {
  if (section !== "collect" || !views) return WORKSPACE_SECTION_LABELS[section];
  const labels = [
    views.showOutliersView ? "Outliers" : null,
    views.showCollectView ? "Ideas" : null,
    views.showHeadlinesView ? "Headlines" : null,
    views.showAvatarView ? "Avatar" : null,
  ].filter((label): label is string => Boolean(label));
  if (labels.length === 1) return labels[0]!;
  return WORKSPACE_SECTION_LABELS.collect;
}

/** Left-rail sections visible for the current workspace settings. */
export function visibleWorkspaceSections(enableCollect: boolean): WorkspaceSection[] {
  return enableCollect ? WORKSPACE_SECTIONS : ["write"];
}
