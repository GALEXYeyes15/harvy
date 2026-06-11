import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  COLLECT_TYPE_OPTIONS,
  createCollectItem,
  formatCollectDateCreated,
  type CollectItem,
} from "../features/collect/collectItems";
import { WorkspaceSectionMainContent } from "./WorkspaceSectionMainContent";

const ADD_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted/55 transition-colors hover:bg-white/[0.06] hover:text-ink dark:hover:text-white/88";

const CELL_INPUT =
  "w-full min-w-0 border-0 bg-transparent p-0 text-[13px] leading-snug text-ink/92 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 dark:text-white/88";

const CELL_SELECT =
  "w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent p-0 text-[12px] text-muted/70 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 dark:text-white/50";

type CollectPanelProps = {
  items: CollectItem[];
  onItemsChange: (items: CollectItem[]) => void;
};

export function CollectPanel({ items, onItemsChange }: CollectPanelProps) {
  const previewInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingFocusId) return;
    previewInputRef.current?.focus();
    setPendingFocusId(null);
  }, [pendingFocusId, items]);

  const updateItem = (itemId: string, patch: Partial<CollectItem>) => {
    onItemsChange(
      items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  };

  const handleAddItem = () => {
    const item = createCollectItem();
    onItemsChange([...items, item]);
    setPendingFocusId(item.id);
  };

  return (
    <WorkspaceSectionMainContent>
      <header className="shrink-0">
        <h1 className="text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-ink">
          Harvy Collect
        </h1>
      </header>

      <div className="harvy-collect-table mt-7">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            className={ADD_BUTTON}
            aria-label="Add collected item"
            onClick={handleAddItem}
          >
            <Plus size={15} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-stage">
            <tr className="border-b border-line/20 dark:border-white/[0.08]">
              <th className="pb-3 pr-4 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
                Preview
              </th>
              <th className="w-[6.5rem] pb-3 pr-4 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
                Type
              </th>
              <th className="w-[7.5rem] pb-3 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
                Date Created
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="py-12 text-center text-[13px] text-muted/55 dark:text-white/38"
                >
                  No collected items yet.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="group border-b border-line/12 transition-colors last:border-b-0 hover:bg-ink/[0.03] dark:border-white/[0.05] dark:hover:bg-white/[0.03]"
                >
                  <td className="py-3.5 pr-4 align-top">
                    <input
                      ref={item.id === pendingFocusId ? previewInputRef : undefined}
                      type="text"
                      value={item.preview}
                      placeholder="Untitled"
                      className={CELL_INPUT}
                      onChange={(event) => updateItem(item.id, { preview: event.target.value })}
                      onClick={(event) => event.stopPropagation()}
                    />
                  </td>
                  <td className="py-3.5 pr-4 align-top">
                    <select
                      value={item.type}
                      className={CELL_SELECT}
                      onChange={(event) => updateItem(item.id, { type: event.target.value })}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {COLLECT_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 align-top">
                    <span className="text-[12px] tabular-nums text-muted/70 dark:text-white/50">
                      {formatCollectDateCreated(item.dateCreated)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </WorkspaceSectionMainContent>
  );
}
