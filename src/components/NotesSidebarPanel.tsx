const DIVIDER = "h-px w-full bg-line/35";

type NotesSidebarPanelProps = {
  notes: string;
  onNotesChange: (value: string) => void;
};

export function NotesSidebarPanel({ notes, onNotesChange }: NotesSidebarPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-ink">Notes</h2>
      </header>

      <div className={`${DIVIDER} my-9`} aria-hidden />

      <p className="shrink-0 text-[13px] leading-relaxed text-muted/80">
        Store ideas, references, reminders, research, and rough thoughts related to your draft. Notes should
        exist alongside the document and be easy to reference while writing.
      </p>

      <div className={`${DIVIDER} my-9`} aria-hidden />

      <label htmlFor="harvy-document-notes" className="sr-only">
        Document notes
      </label>
      <textarea
        id="harvy-document-notes"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Ideas, references, reminders…"
        className="min-h-0 w-full flex-1 resize-none rounded-md border-0 bg-canvas/45 px-3 py-2.5 text-[13px] leading-relaxed text-ink placeholder:text-muted/65 focus:outline-none focus:ring-0 dark:bg-canvas/35"
      />
    </div>
  );
}
