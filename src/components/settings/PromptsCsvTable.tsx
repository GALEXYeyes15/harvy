import type { EditorPrompt } from "../../features/editor/editorPromptSettings";

const PROMPT_CELL_CLASS =
  "w-full min-w-0 border-0 bg-transparent px-2.5 py-2 text-[12px] leading-snug text-ink outline-none placeholder:text-muted/55 focus:bg-canvas/35 disabled:cursor-default disabled:text-muted/70";

export type PromptsCsvTableProps = {
  prompts: EditorPrompt[];
  onUpdate: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  maxHeightClass?: string;
  fillHeight?: boolean;
};

export function PromptsCsvTable({
  prompts,
  onUpdate,
  onRemove,
  maxHeightClass,
  fillHeight = false,
}: PromptsCsvTableProps) {
  return (
    <div
      className={`overflow-auto rounded-lg bg-mist/90 ring-1 ring-line/15 dark:bg-ink/[0.04] dark:ring-white/8 ${maxHeightClass ?? ""} ${fillHeight ? "flex flex-col" : ""}`}
    >
      <table className={`h-auto w-full table-fixed border-collapse text-left ${fillHeight ? "shrink-0" : ""}`}>
        <thead>
          <tr>
            <th className="w-[90%] px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted/55">
              Prompt
            </th>
            <th className="w-[10%] px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted/55">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {prompts.map((prompt) => {
            const locked = Boolean(prompt.locked);
            return (
              <tr
                key={prompt.id}
                className="border-b border-line/12 last:border-b-0 dark:border-white/[0.06]"
              >
                <td className="align-top">
                  <input
                    type="text"
                    value={prompt.text}
                    onChange={(event) => onUpdate(prompt.id, event.target.value)}
                    placeholder="Add a writing prompt…"
                    className={PROMPT_CELL_CLASS}
                    aria-label={locked ? "Default prompt" : "Prompt"}
                    disabled={locked}
                    readOnly={locked}
                    data-prompt-id={prompt.id}
                    data-prompt-field="text"
                  />
                </td>
                <td className="align-middle border-l border-line/12 text-center dark:border-white/[0.06]">
                  {locked ? (
                    <span className="px-1.5 py-1 text-[11px] text-muted/40" aria-label="Default prompt cannot be removed">
                      —
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRemove(prompt.id)}
                      className="rounded-md px-1.5 py-1 text-[11px] text-muted/60 transition-colors hover:bg-ink/[0.06] hover:text-ink"
                      aria-label="Remove prompt"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
