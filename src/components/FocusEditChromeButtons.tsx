import { Clock } from "lucide-react";
import { formatHotkeyChord } from "../features/settings/hotkeys";

const ICON_BUTTON =
  "harvy-chrome-icon-btn pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-accent";

type FocusEditChromeButtonsProps = {
  /** Desktop shows the keyboard shortcut in the tooltip. iPad has no use for it. */
  showShortcutHints?: boolean;
  onStartFocus: () => void;
};

/** Focus-mode clock beside the tools panel. Edit highlights stay on Mod+E. */
export function FocusEditChromeButtons({
  showShortcutHints = true,
  onStartFocus,
}: FocusEditChromeButtonsProps) {
  const focusTitle = showShortcutHints
    ? `Start focus mode (${formatHotkeyChord(["Option", "F"])})`
    : undefined;

  return (
    <button
      type="button"
      onClick={onStartFocus}
      aria-label="Start focus mode"
      title={focusTitle}
      className={ICON_BUTTON}
    >
      <Clock size={17} strokeWidth={1.5} aria-hidden />
    </button>
  );
}
