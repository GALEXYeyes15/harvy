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
 * but never into overlay sidebars. The left edge stays where it sits with both
 * sidebars closed (window-centered); an overlapping right sidebar trims the column
 * from the right, and only an overlapping left sidebar pushes the left edge over.
 */
export function editorColumnLayout(input: EditorColumnLayoutInput): EditorColumnLayout {
  const lineExpansionPx = Math.max(0, input.lineExpansionPx);
  const leftReservePx = Math.max(0, input.leftReservePx);
  const rightReservePx = Math.max(0, input.rightReservePx);
  const windowWidthPx = Math.max(0, input.windowWidthPx);
  const closedWidthPx = Math.min(input.baseWidthPx + lineExpansionPx, windowWidthPx);
  const paddingLeftPx = Math.max(leftReservePx, (windowWidthPx - closedWidthPx) / 2);
  const maxWidthPx = Math.max(
    0,
    Math.min(closedWidthPx, windowWidthPx - paddingLeftPx - rightReservePx),
  );
  const paddingRightPx = Math.max(0, windowWidthPx - maxWidthPx - paddingLeftPx);
  return { maxWidthPx, paddingLeftPx, paddingRightPx };
}
