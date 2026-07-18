import type { EncouragementPhrase } from "../../features/encouragement/encouragementSettings";

const PHRASE_CELL_CLASS =
  "w-full min-w-0 border-0 bg-transparent px-2.5 py-2 text-[12px] leading-snug text-ink outline-none placeholder:text-muted/55 focus:bg-canvas/35";

export type PhrasesCsvTableProps = {
  phrases: EncouragementPhrase[];
  onUpdate: (id: string, partial: Partial<Pick<EncouragementPhrase, "text" | "author">>) => void;
  onRemove: (id: string) => void;
  maxHeightClass?: string;
  fillHeight?: boolean;
};

export function PhrasesCsvTable({
  phrases,
  onUpdate,
  onRemove,
  maxHeightClass,
  fillHeight = false,
}: PhrasesCsvTableProps) {
  return (
    <div
      className={`overflow-auto rounded-lg bg-mist/90 ring-1 ring-line/15 dark:bg-ink/[0.04] dark:ring-white/8 ${maxHeightClass ?? ""} ${fillHeight ? "flex flex-col" : ""}`}
    >
      <table className={`w-full table-fixed border-collapse text-left ${fillHeight ? "min-h-full" : ""}`}>
        <thead>
          <tr>
            <th className="w-[58%] px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted/55">
              Quote
            </th>
            <th className="w-[32%] px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted/55">
              Said by
            </th>
            <th className="w-[10%] px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted/55">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {phrases.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-2.5 py-4 text-[12px] text-muted/70">
                No phrases yet. Click Add row to start a table.
              </td>
            </tr>
          ) : (
            phrases.map((phrase) => (
              <tr
                key={phrase.id}
                className="border-b border-line/12 last:border-b-0 dark:border-white/[0.06]"
              >
                <td className="align-top">
                  <input
                    type="text"
                    value={phrase.text}
                    onChange={(e) => onUpdate(phrase.id, { text: e.target.value })}
                    placeholder="You can do hard things."
                    className={PHRASE_CELL_CLASS}
                    aria-label="Quote"
                    data-phrase-id={phrase.id}
                    data-phrase-field="quote"
                  />
                </td>
                <td className="align-top border-l border-line/12 dark:border-white/[0.06]">
                  <input
                    type="text"
                    value={phrase.author}
                    onChange={(e) => onUpdate(phrase.id, { author: e.target.value })}
                    placeholder="Someone kind"
                    className={PHRASE_CELL_CLASS}
                    aria-label="Said by"
                    data-phrase-id={phrase.id}
                    data-phrase-field="author"
                  />
                </td>
                <td className="align-middle border-l border-line/12 text-center dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => onRemove(phrase.id)}
                    className="rounded-md px-1.5 py-1 text-[11px] text-muted/60 transition-colors hover:bg-ink/[0.06] hover:text-ink"
                    aria-label="Remove phrase"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
