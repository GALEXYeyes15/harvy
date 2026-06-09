/** Left file sidebar width (matches AppShell overlay rail). */
export const WORKSPACE_SIDEBAR_WIDTH_PX = 260;

/** Collect / Write / Format switcher column width (3.25rem). */
export const WORKSPACE_SECTION_SWITCHER_WIDTH_PX = 52;

/** Left inset when the workspace sidebar is collapsed — matches tab bar / title `pl-10`. */
export const WORKSPACE_SECTION_RAIL_COLLAPSED_LEFT_PX = 12;

export type WorkspaceSection = "collect" | "write" | "format";

export const WORKSPACE_SECTIONS: WorkspaceSection[] = ["collect", "write", "format"];

export const WORKSPACE_SECTION_LABELS: Record<WorkspaceSection, string> = {
  collect: "Collect",
  write: "Write",
  format: "Format",
};
