/** Left file sidebar width (matches AppShell overlay rail). */
export const WORKSPACE_SIDEBAR_WIDTH_PX = 260;

/** Collect / Write / Format switcher column width (3.25rem). */
export const WORKSPACE_SECTION_SWITCHER_WIDTH_PX = 52;

export type WorkspaceSection = "collect" | "write" | "format";

export const WORKSPACE_SECTIONS: WorkspaceSection[] = ["collect", "write", "format"];

export const WORKSPACE_SECTION_LABELS: Record<WorkspaceSection, string> = {
  collect: "Collect",
  write: "Write",
  format: "Format",
};
