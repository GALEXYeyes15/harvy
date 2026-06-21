/** Left file sidebar width (matches AppShell overlay rail). */
export const WORKSPACE_SIDEBAR_WIDTH_PX = 260;

/** Collect / Write switcher column width (3.25rem). */
export const WORKSPACE_SECTION_SWITCHER_WIDTH_PX = 52;

export type WorkspaceSection = "collect" | "write";

export const WORKSPACE_SECTIONS: WorkspaceSection[] = ["collect", "write"];

export const WORKSPACE_SECTION_LABELS: Record<WorkspaceSection, string> = {
  collect: "Collect",
  write: "Write",
};

/** Left-rail sections visible for the current workspace settings. */
export function visibleWorkspaceSections(enableCollect: boolean): WorkspaceSection[] {
  return enableCollect ? WORKSPACE_SECTIONS : ["write"];
}
