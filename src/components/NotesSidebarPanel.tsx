type NotesSidebarPanelProps = {
  notes: string;
  onNotesChange: (value: string) => void;
};

export function NotesSidebarPanel({ notes, onNotesChange }: NotesSidebarPanelProps) {
  return (
    <div className="flex flex-col">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-ink">Notes</h2>
      </header>

      <label htmlFor="harvy-document-notes" className="sr-only">
        Document note
      </label>
      <textarea
        id="harvy-document-notes"
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Ideas, references, reminders…"
        className="mt-6 h-[30rem] w-full resize-none overflow-y-auto rounded-md border-0 bg-canvas/45 px-3 py-2.5 text-[13px] leading-relaxed text-ink placeholder:text-muted/65 focus:outline-none focus:ring-0 dark:bg-canvas/35"
      />
    </div>
  );
}
