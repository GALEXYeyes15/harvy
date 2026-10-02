import { Clock } from "lucide-react";
import { CHROME_SIDEBAR_TOGGLE_CLASS } from "./ChromeSidebarToggleButton";

type FocusEditChromeButtonsProps = {
  editMarksOn: boolean;
  onStartFocus: () => void;
  onToggleEditMarks: () => void;
};

export function FocusEditChromeButtons({
  editMarksOn,
  onStartFocus,
  onToggleEditMarks,
}: FocusEditChromeButtonsProps) {
  const editLabel = editMarksOn ? "Hide edit highlights" : "Show edit highlights";

  return (
    <>
      <button
        type="button"
        onClick={onStartFocus}
        aria-label="Start focus mode"
        title="Start focus mode"
        className={CHROME_SIDEBAR_TOGGLE_CLASS}
      >
        <Clock size={17} strokeWidth={1.5} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onToggleEditMarks}
        aria-pressed={editMarksOn}
        aria-label={editLabel}
        title={editLabel}
        className={`${CHROME_SIDEBAR_TOGGLE_CLASS} ${editMarksOn ? "bg-accent/15" : ""}`}
      >
        <span className="relative inline-block px-px text-[15px] font-medium leading-none">
          A
          <span
            aria-hidden
            className="absolute -bottom-[5px] left-0 right-0 h-[3px] bg-[radial-gradient(circle,#e5484d_1.15px,transparent_1.3px)] bg-[length:4px_3px] bg-bottom bg-repeat-x"
          />
        </span>
      </button>
    </>
  );
}
