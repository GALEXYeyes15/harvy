type SidebarLayoutIconProps = {
  size?: number;
  strokeWidth?: number;
  className?: string;
};

/**
 * Stroke-only frame (3:2) with vertical guides at 25% / 75% width — left rail, content, right rail.
 * Geometry is expanded toward the 24×24 viewBox edges so it matches Lucide’s optical weight at the same `size`.
 */
export function SidebarLayoutIcon({
  size = 19,
  strokeWidth = 1.5,
  className,
}: SidebarLayoutIconProps) {
  const vb = 24;
  /** Outer frame: 3:2, maximized in viewBox (~1.5px margin for 1.5 stroke, no clip). */
  const w = 18;
  const h = 12;
  const x = (vb - w) / 2;
  const y = (vb - h) / 2;
  const rx = 2;
  /** Short vertical inset only — lines read longer / closer to Lucide cap height. */
  const padY = 1.75;
  const y1 = y + padY;
  const y2 = y + h - padY;
  const x25 = x + w * 0.25;
  const x75 = x + w * 0.75;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vb} ${vb}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={x25}
        y1={y1}
        x2={x25}
        y2={y2}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <line
        x1={x75}
        y1={y1}
        x2={x75}
        y2={y2}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}
