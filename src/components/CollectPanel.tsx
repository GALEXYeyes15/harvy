import { ArrowUpRight, Check, NotepadText, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  COLLECT_FORMAT_OPTIONS,
  COLLECT_TYPE_OPTIONS,
  createCollectItem,
  formatCollectDateCreated,
  type CollectItem,
} from "../features/collect/collectItems";
import { CollectItemModal } from "./CollectItemModal";
import { OutliersView } from "./OutliersView";
import { WorkspaceSectionMainContent } from "./WorkspaceSectionMainContent";

const ADD_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-accent/65 transition-colors hover:bg-white/[0.06] hover:text-accent";

const SELECTION_ACTION_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-accent/65 transition-colors hover:bg-white/[0.06] hover:text-accent";

const SUB_VIEW_TAB =
  "border-0 bg-transparent p-0 text-[1.375rem] font-semibold leading-none tracking-[-0.02em]";

type CollectSubView = "outliers" | "collect";

const CELL_SELECT =
  "w-full min-w-0 cursor-pointer appearance-none border-0 bg-transparent p-0 text-[12px] text-muted/70 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 dark:text-white/50";

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
      className={`harvy-checkbox flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-sm transition-opacity duration-150 ${
        checked
          ? "harvy-checkbox--checked opacity-100"
          : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {checked ? <Check size={14} strokeWidth={2.75} className="text-white" aria-hidden /> : null}
    </button>
  );
}

function CollectSelectionActions({
  selectedCount,
  onDelete,
  onAddToNotes,
}: {
  selectedCount: number;
  onDelete: () => void;
  onAddToNotes: () => void;
}) {
  const labelSuffix = selectedCount === 1 ? "selected item" : "selected items";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={SELECTION_ACTION_BUTTON}
        aria-label={`Delete ${selectedCount} ${labelSuffix}`}
        onClick={onDelete}
      >
        <Trash2 size={15} strokeWidth={1.75} aria-hidden />
      </button>
      <button
        type="button"
        className={SELECTION_ACTION_BUTTON}
        aria-label={`Add ${selectedCount} ${labelSuffix} to Notes`}
        onClick={onAddToNotes}
      >
        <NotepadText size={15} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

function CollectSubViewTabs({
  activeView,
  onViewChange,
  showOutliersView,
  showCollectView,
}: {
  activeView: CollectSubView;
  onViewChange: (view: CollectSubView) => void;
  showOutliersView: boolean;
  showCollectView: boolean;
}) {
  return (
    <div className="flex items-baseline gap-7" role="tablist" aria-label="Collect views">
      {showOutliersView ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "outliers"}
          className={`${SUB_VIEW_TAB} text-ink ${
            activeView === "outliers" ? "opacity-100" : "opacity-40"
          }`}
          onClick={() => onViewChange("outliers")}
        >
          Outliers
        </button>
      ) : null}
      {showCollectView ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "collect"}
          className={`${SUB_VIEW_TAB} text-ink ${
            activeView === "collect" ? "opacity-100" : "opacity-40"
          }`}
          onClick={() => onViewChange("collect")}
        >
          Collect
        </button>
      ) : null}
    </div>
  );
}

type CollectPanelProps = {
  items: CollectItem[];
  onItemsChange: (items: CollectItem[]) => void;
  onAddPreviewToNotes?: (preview: string) => void;
  showOutliersView?: boolean;
  showCollectView?: boolean;
  workspaceSidebarOpen?: boolean;
  toolsSidebarOpen?: boolean;
};

export function CollectPanel({
  items,
  onItemsChange,
  onAddPreviewToNotes,
  showOutliersView = true,
  showCollectView = true,
  workspaceSidebarOpen = true,
  toolsSidebarOpen = true,
}: CollectPanelProps) {
  const [activeCollectView, setActiveCollectView] = useState<CollectSubView>(() =>
    showCollectView ? "collect" : "outliers",
  );
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (activeCollectView === "outliers" && !showOutliersView && showCollectView) {
      setActiveCollectView("collect");
      return;
    }
    if (activeCollectView === "collect" && !showCollectView && showOutliersView) {
      setActiveCollectView("outliers");
    }
  }, [activeCollectView, showOutliersView, showCollectView]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

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
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const removeSelectedItems = () => {
    if (selectedIds.size === 0) return;
    onItemsChange(items.filter((item) => !selectedIds.has(item.id)));
    if (activeItemId && selectedIds.has(activeItemId)) {
      setActiveItemId(null);
    }
    setSelectedIds(new Set());
  };

  const handleAddSelectedToNotes = () => {
    if (selectedItems.length === 0 || !onAddPreviewToNotes) return;

    const combined = selectedItems
      .map((item) => item.preview.trim())
      .filter(Boolean)
      .join("\n\n");

    if (!combined) return;
    onAddPreviewToNotes(combined);
  };

  return (
    <>
      <WorkspaceSectionMainContent>
        <header className="shrink-0">
          {showOutliersView && showCollectView ? (
            <CollectSubViewTabs
              activeView={activeCollectView}
              onViewChange={setActiveCollectView}
              showOutliersView={showOutliersView}
              showCollectView={showCollectView}
            />
          ) : (
            <h2 className="text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-ink">
              {showOutliersView ? "Outliers" : "Collect"}
            </h2>
          )}
        </header>

        {activeCollectView === "collect" && showCollectView ? (
        <div className="harvy-collect-table mt-7">
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
                  Collected
                </th>
                <th className="relative w-9 overflow-visible pb-3 pt-1">
                  {selectedIds.size > 0 ? (
                    <div className="absolute inset-y-0 right-0 flex items-center gap-1.5">
                      <CollectSelectionActions
                        selectedCount={selectedIds.size}
                        onDelete={removeSelectedItems}
                        onAddToNotes={handleAddSelectedToNotes}
                      />
                    </div>
                  ) : null}
                </th>
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
                        <div className="flex items-center justify-end">
                          <CollectRowCheckbox
                            checked={isSelected}
                            onToggle={() => toggleSelected(item.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
            <button
              type="button"
              className={`${ADD_BUTTON} mt-7`}
              aria-label="Add collected item"
              onClick={handleAddItem}
            >
              <Plus size={15} strokeWidth={2} aria-hidden />
            </button>
        </div>
        ) : showOutliersView ? (
          <OutliersView
            onAddToNotes={onAddPreviewToNotes}
            workspaceSidebarOpen={workspaceSidebarOpen}
            toolsSidebarOpen={toolsSidebarOpen}
          />
        ) : null}
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
