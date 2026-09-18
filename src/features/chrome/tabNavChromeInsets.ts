/** Back / forward tab nav buttons in {@link OpenWindowsBar} — `w-7`. */
export const TAB_NAV_BTN_WIDTH = "1.75rem";

/** Left padding before the back button (matches tab bar nav group). */
export function tabNavLeadingPadding(
  workspaceSidebarOpen: boolean,
  isWindowFullscreen: boolean,
): string {
  if (workspaceSidebarOpen) {
    return "var(--harvy-workspace-chrome-gutter)";
  }
  return isWindowFullscreen
    ? "2.5rem"
    : "calc(var(--harvy-traffic-light-inset, 0px) + 2.5rem)";
}

/** Document title left edge — aligns with the right edge of the back arrow. */
export function documentTitlePaddingLeft(
  workspaceSidebarOpen: boolean,
  isWindowFullscreen: boolean,
): string {
  return `calc(${tabNavLeadingPadding(workspaceSidebarOpen, isWindowFullscreen)} + ${TAB_NAV_BTN_WIDTH})`;
}
