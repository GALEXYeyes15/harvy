/** Default Write column width (matches the long-standing `max-w-[820px]` editor). */
export const EDITOR_COLUMN_BASE_PX = 820;

export type EditorColumnLayoutInput = {
  baseWidthPx: number;
  lineExpansionPx: number;
  windowWidthPx: number;
  leftReservePx: number;
  rightReservePx: number;
};

export type EditorColumnLayout = {
  maxWidthPx: number;
  paddingLeftPx: number;
  paddingRightPx: number;
};

/**
 * Size and position the Write column: grow from the base width by line expansion,
 * but never into overlay sidebars. When the expanded column still fits, it stays
 * window-centered so expansion 0 matches today’s layout.
 */
export function editorColumnLayout(input: EditorColumnLayoutInput): EditorColumnLayout {
  const lineExpansionPx = Math.max(0, input.lineExpansionPx);
  const leftReservePx = Math.max(0, input.leftReservePx);
  const rightReservePx = Math.max(0, input.rightReservePx);
  const windowWidthPx = Math.max(0, input.windowWidthPx);
  const desired = input.baseWidthPx + lineExpansionPx;
  const available = Math.max(0, windowWidthPx - leftReservePx - rightReservePx);
  const maxWidthPx = Math.min(desired, available);
  const idealLeft = (windowWidthPx - maxWidthPx) / 2;
  let paddingLeftPx = Math.max(leftReservePx, idealLeft);
  let paddingRightPx = windowWidthPx - maxWidthPx - paddingLeftPx;
  if (paddingRightPx < rightReservePx) {
    paddingRightPx = rightReservePx;
    paddingLeftPx = Math.max(leftReservePx, windowWidthPx - maxWidthPx - paddingRightPx);
  }
  return { maxWidthPx, paddingLeftPx, paddingRightPx };
}
