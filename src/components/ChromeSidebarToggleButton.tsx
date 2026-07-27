import type { LucideIcon } from "lucide-react";

/** Matches workspace (left) panel control in AppShell — reuse for any mirrored chrome toggle. */
export const CHROME_SIDEBAR_TOGGLE_CLASS =
  "pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-accent transition-colors hover:bg-accent/10 hover:text-accent";

type ChromeSidebarToggleButtonProps = {
  icon: LucideIcon;
  /** Whether the target panel is currently open (drives `aria-expanded` and optional label). */
  open: boolean;
  onClick: () => void;
  ariaLabelOpen: string;
  ariaLabelClosed: string;
};

export function ChromeSidebarToggleButton({
  icon: Icon,
  open,
  onClick,
  ariaLabelOpen,
  ariaLabelClosed,
}: ChromeSidebarToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? ariaLabelOpen : ariaLabelClosed}
      aria-expanded={open}
      className={CHROME_SIDEBAR_TOGGLE_CLASS}
    >
      <Icon size={17} strokeWidth={1.5} aria-hidden />
    </button>
  );
}
