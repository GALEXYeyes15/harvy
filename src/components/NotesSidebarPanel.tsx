import { SquareArrowOutUpRight } from "lucide-react";
import { handleNotesTextareaTabKey } from "../features/notes/notesTextareaIndent";
import type { HeadlinePair } from "../features/aiCheck/aiCheck";
import { NotesHeadlinePairsPanel } from "./NotesHeadlinePairsPanel";
import { QuickLinksSidebarPanel } from "./QuickLinksSidebarPanel";

type NotesSidebarPanelProps = {
  notes: string;
  onNotesChange: (value: string) => void;
  /** Open / close the centered majority-screen Notes window. */
  onTogglePopout?: () => void;
  /** When on, Quick Links appears below Notes. */
  showQuickLinks?: boolean;
  showHeadlines?: boolean;
  headlinesEnabled?: boolean;
  headlinesRunning?: boolean;
  headlinesError?: string | null;
  headlinePairs?: HeadlinePair[];
  selectedHeadlineIndex?: number | null;
  onGenerateHeadlines?: () => void | Promise<void>;
  onSelectHeadlinePair?: (pair: HeadlinePair, index: number) => void;
};

export function NotesSidebarPanel({
  notes,
  onNotesChange,
  onTogglePopout,
  showQuickLinks = false,
  showHeadlines = false,
  headlinesEnabled = false,
  headlinesRunning = false,
  headlinesError = null,
  headlinePairs = [],
  selectedHeadlineIndex = null,
  onGenerateHeadlines,
  onSelectHeadlinePair,
}: NotesSidebarPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex shrink-0 items-center gap-2">
        <h2 className="text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-ink">Notes</h2>
        {onTogglePopout ? (
          <button
            type="button"
            onClick={onTogglePopout}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-accent transition-colors hover:bg-accent/10 hover:text-accent"
            aria-label="Open notes in a separate window"
            title="Open notes in a separate window"
          >
            <SquareArrowOutUpRight size={15} strokeWidth={1.5} aria-hidden />
          </button>
        ) : null}
      </header>

      <label htmlFor="harvy-document-notes" className="sr-only">
        Document note
      </label>
      <textarea
        id="harvy-document-notes"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        onKeyDown={(e) => handleNotesTextareaTabKey(e, e.currentTarget, onNotesChange)}
        placeholder="Ideas, references, reminders…"
        className="mt-6 min-h-[12rem] w-full flex-1 resize-none overflow-y-auto rounded-md border-0 bg-mist px-3 py-2.5 text-[13px] leading-relaxed text-ink focus:outline-none focus:ring-0"
      />

      {showQuickLinks ? (
        <div className="mt-6 shrink-0">
          <QuickLinksSidebarPanel />
        </div>
      ) : null}

      {showHeadlines && onGenerateHeadlines && onSelectHeadlinePair ? (
        <div className="mt-6 shrink-0">
          <NotesHeadlinePairsPanel
            enabled={headlinesEnabled}
            running={headlinesRunning}
            error={headlinesError}
            pairs={headlinePairs}
            selectedIndex={selectedHeadlineIndex}
            onGenerate={onGenerateHeadlines}
            onSelectPair={onSelectHeadlinePair}
          />
        </div>
      ) : null}
    </div>
  );
}
