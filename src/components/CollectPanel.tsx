import { ArrowUpRight, Check, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  COLLECT_FORMAT_OPTIONS,
  COLLECT_TYPE_OPTIONS,
  createCollectItem,
  formatCollectDateCreated,
  type CollectItem,
} from "../features/collect/collectItems";
import { CollectItemModal } from "./CollectItemModal";
import { CollectRowActionMenu } from "./CollectRowActionMenu";
import { WorkspaceSectionMainContent } from "./WorkspaceSectionMainContent";

const ADD_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted/55 transition-colors hover:bg-white/[0.06] hover:text-ink dark:hover:text-white/88";

const CELL_SELECT =
  "w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent p-0 text-[12px] text-muted/70 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 dark:text-white/50";

type CollectPanelProps = {
  items: CollectItem[];
  onItemsChange: (items: CollectItem[]) => void;
  onAddPreviewToNotes?: (preview: string) => void;
};

function CollectRowSelectCell({
  checked,
  showMenu,
  onToggle,
  onDelete,
  onAddToNotes,
}: {
  checked: boolean;
  showMenu: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onAddToNotes: () => void;
}) {
  const anchorRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={anchorRef} className="relative flex items-center justify-end">
      <CollectRowCheckbox checked={checked} onToggle={onToggle} />
      {showMenu ? (
        <CollectRowActionMenu
          anchorRef={anchorRef as RefObject<HTMLElement | null>}
          onDelete={onDelete}
          onAddToNotes={onAddToNotes}
        />
      ) : null}
    </div>
  );
}

function CollectRowCheckbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? "Deselect row" : "Select row"}
      className={`flex h-4 w-4 items-center justify-center rounded-sm border transition-[opacity,background-color,border-color] duration-150 ${
        checked
          ? "border-[#2fbf71] bg-[#2fbf71] opacity-100"
          : "border-line/45 bg-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 dark:border-white/22"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {checked ? <Check size={11} strokeWidth={2.75} className="text-white" aria-hidden /> : null}
    </button>
  );
}

export function CollectPanel({ items, onItemsChange, onAddPreviewToNotes }: CollectPanelProps) {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [openMenuItemId, setOpenMenuItemId] = useState<string | null>(null);
  const openMenuAnchorRef = useRef<HTMLDivElement | null>(null);

  const activeItem = useMemo(
    () => items.find((item) => item.id === activeItemId) ?? null,
    [items, activeItemId],
  );

  useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(items.map((item) => item.id));
      const next = new Set([...current].filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [items]);

  useEffect(() => {
    if (!openMenuItemId) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const menu = document.querySelector("[data-collect-row-menu]");
      if (menu?.contains(target)) return;

      if (openMenuAnchorRef.current?.contains(target)) return;

      setOpenMenuItemId(null);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [openMenuItemId]);

  const updateItem = (itemId: string, patch: Partial<CollectItem>) => {
    onItemsChange(
      items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  };

  const openItem = (itemId: string) => {
    setActiveItemId(itemId);
  };

  const handleAddItem = () => {
    const item = createCollectItem();
    onItemsChange([...items, item]);
    setActiveItemId(item.id);
  };

  const toggleSelected = (itemId: string) => {
    const isSelected = selectedIds.has(itemId);

    if (isSelected) {
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });
      setOpenMenuItemId((open) => (open === itemId ? null : open));
      return;
    }

    setSelectedIds((current) => new Set(current).add(itemId));
    setOpenMenuItemId(itemId);
  };

  const removeItem = (itemId: string) => {
    onItemsChange(items.filter((item) => item.id !== itemId));
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
    if (openMenuItemId === itemId) {
      setOpenMenuItemId(null);
    }
    if (activeItemId === itemId) {
      setActiveItemId(null);
    }
  };

  const handleAddToNotes = (item: CollectItem) => {
    onAddPreviewToNotes?.(item.preview);
    setOpenMenuItemId(null);
  };

  return (
    <>
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
                  Format
                </th>
                <th className="w-[5.5rem] pb-3 pr-4 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
                  Type
                </th>
                <th className="w-[7.5rem] pb-3 pr-2 pt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60">
                  Date Created
                </th>
                <th className="w-9 pb-3 pt-1" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-[13px] text-muted/55 dark:text-white/38"
                  >
                    No collected items yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const showMenu = isSelected && openMenuItemId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={`group cursor-pointer border-b border-line/12 transition-colors last:border-b-0 dark:border-white/[0.05] ${
                        isSelected
                          ? "bg-ink/[0.07] dark:bg-white/[0.06]"
                          : "hover:bg-ink/[0.045] dark:hover:bg-white/[0.04]"
                      }`}
                      onClick={() => openItem(item.id)}
                    >
                      <td className="max-w-0 py-3.5 pr-4 align-middle">
                        <div className="relative flex min-w-0 items-center">
                          <p
                            className={`min-w-0 flex-1 truncate pr-2 text-[13px] leading-snug transition-[padding] duration-150 group-hover:pr-[4.25rem] ${
                              item.preview.trim()
                                ? "text-ink/92 dark:text-white/88"
                                : "text-muted/55 dark:text-white/38"
                            }`}
                          >
                            {item.preview.trim() || "Untitled"}
                          </p>
                          <button
                            type="button"
                            className="harvy-collect-open-button absolute right-0 top-1/2 -translate-y-1/2"
                            aria-label="Open collected item"
                            onClick={(event) => {
                              event.stopPropagation();
                              openItem(item.id);
                            }}
                          >
                            <ArrowUpRight size={11} strokeWidth={2.25} aria-hidden />
                            OPEN
                          </button>
                        </div>
                      </td>
                      <td
                        className="py-3.5 pr-4 align-top"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <select
                          value={item.format}
                          className={CELL_SELECT}
                          onChange={(event) => updateItem(item.id, { format: event.target.value })}
                        >
                          {!(COLLECT_FORMAT_OPTIONS as readonly string[]).includes(item.format) ? (
                            <option value={item.format}>{item.format}</option>
                          ) : null}
                          {COLLECT_FORMAT_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td
                        className="py-3.5 pr-4 align-top"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <select
                          value={item.type}
                          className={CELL_SELECT}
                          onChange={(event) =>
                            updateItem(item.id, {
                              type: event.target.value as CollectItem["type"],
                            })
                          }
                        >
                          {COLLECT_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3.5 pr-2 align-top">
                        <span className="text-[12px] tabular-nums text-muted/70 dark:text-white/50">
                          {formatCollectDateCreated(item.dateCreated)}
                        </span>
                      </td>
                      <td
                        className="py-3 align-top"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div
                          ref={showMenu ? openMenuAnchorRef : undefined}
                        >
                          <CollectRowSelectCell
                            checked={isSelected}
                            showMenu={showMenu}
                            onToggle={() => toggleSelected(item.id)}
                            onDelete={() => removeItem(item.id)}
                            onAddToNotes={() => handleAddToNotes(item)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </WorkspaceSectionMainContent>

      <CollectItemModal
        open={activeItemId !== null}
        item={activeItem}
        onClose={() => setActiveItemId(null)}
        onUpdateItem={updateItem}
      />
    </>
  );
}
