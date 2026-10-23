import { Clock } from "lucide-react";
import { formatHotkeyChord } from "../features/settings/hotkeys";

const ICON_BUTTON =
  "harvy-chrome-icon-btn pointer-events-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-[background-color] hover:bg-accent/10";

/** Dots are this letter’s own background, so they take its color in the same paint. */
const EDIT_MARK =
  "harvy-edit-mark inline-block bg-[length:4px_3px] bg-bottom bg-repeat-x bg-[radial-gradient(circle,currentColor_1.15px,transparent_1.3px)] px-px pb-[3px] -mb-[3px] text-[15px] font-medium leading-none";

type FocusEditChromeButtonsProps = {
  editMarksOn: boolean;
  /** Right sidebar owns edit highlights, so the corner control stays off. */
  editMarksDisabled?: boolean;
  /** Desktop shows the keyboard shortcut in the tooltip. iPad has no use for it. */
  showShortcutHints?: boolean;
  onStartFocus: () => void;
  onToggleEditMarks: () => void;
};

export function FocusEditChromeButtons({
  editMarksOn,
  editMarksDisabled = false,
  showShortcutHints = true,
  onStartFocus,
  onToggleEditMarks,
}: FocusEditChromeButtonsProps) {
  const editLabel = editMarksOn ? "Hide edit highlights" : "Show edit highlights";
  const focusTitle = showShortcutHints
    ? `Start focus mode (${formatHotkeyChord(["Option", "F"])})`
    : undefined;
  const editTitle = !showShortcutHints
    ? undefined
    : editMarksDisabled
      ? "Unavailable while the sidebar is open"
      : `${editLabel} (${formatHotkeyChord(["Mod", "E"])})`;

  return (
    <>
      <button
        type="button"
        onClick={onStartFocus}
        aria-label="Start focus mode"
        title={focusTitle}
        className={`${ICON_BUTTON} text-accent hover:text-white`}
      >
        <Clock size={17} strokeWidth={1.5} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onToggleEditMarks}
        disabled={editMarksDisabled}
        aria-pressed={editMarksOn}
        aria-label={editLabel}
        title={editTitle}
        className={`${ICON_BUTTON} disabled:cursor-default disabled:bg-transparent disabled:text-accent disabled:opacity-100 disabled:hover:bg-transparent disabled:hover:text-accent ${
          editMarksOn && !editMarksDisabled
            ? "bg-accent/15 text-white"
            : "text-accent hover:text-white"
        }`}
        style={
          editMarksDisabled
            ? { color: "var(--color-accent)", WebkitTextFillColor: "var(--color-accent)" }
            : undefined
        }
      >
        <span className={EDIT_MARK}>A</span>
      </button>
    </>
  );
}
