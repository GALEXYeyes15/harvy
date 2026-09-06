import {
  Check,
  FileText,
  NotepadText,
  RefreshCw,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type CollectItem } from "../features/collect/collectItems";
import {
  getNotionIdeasConfig,
  mergeNotionIdeasIntoCollectItems,
  queryNotionIdeaPages,
  readNotionIdeasLastSyncedAt,
  writeNotionIdeasLastSyncedAt,
} from "../features/notion/notionIdeas";
import { formatFetchedAgo } from "../features/outliers/outlierPosts";
import { isTauriRuntime } from "../features/save/saveRuntime";
import { AvatarView } from "./AvatarView";
import { CollectItemModal } from "./CollectItemModal";
import { HeadlinesView } from "./HeadlinesView";
import { OutliersView } from "./OutliersView";
import { WorkspaceSectionMainContent } from "./WorkspaceSectionMainContent";

const SELECTION_ACTION_BUTTON =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-accent/65 transition-colors hover:bg-white/[0.06] hover:text-accent";

const SUB_VIEW_TAB =
  "border-0 bg-transparent p-0 text-[1.375rem] font-semibold leading-none tracking-[-0.02em]";

export type CollectSubView = "outliers" | "collect" | "headlines" | "avatar";

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
  showHeadlinesView,
  showAvatarView,
}: {
  activeView: CollectSubView;
  onViewChange: (view: CollectSubView) => void;
  showOutliersView: boolean;
  showCollectView: boolean;
  showHeadlinesView: boolean;
  showAvatarView: boolean;
}) {
  return (
    <div className="flex items-baseline gap-7" role="tablist" aria-label="Research views">
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
          Ideas
        </button>
      ) : null}
      {showHeadlinesView ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "headlines"}
          className={`${SUB_VIEW_TAB} text-ink ${
            activeView === "headlines" ? "opacity-100" : "opacity-40"
          }`}
          onClick={() => onViewChange("headlines")}
        >
          Headlines
        </button>
      ) : null}
      {showAvatarView ? (
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "avatar"}
          className={`${SUB_VIEW_TAB} text-ink ${
            activeView === "avatar" ? "opacity-100" : "opacity-40"
          }`}
          onClick={() => onViewChange("avatar")}
        >
          Avatar
        </button>
      ) : null}
    </div>
  );
}

function soleCollectViewTitle(views: {
  showOutliersView: boolean;
  showCollectView: boolean;
  showHeadlinesView: boolean;
  showAvatarView: boolean;
}): string {
  const labels = [
    views.showOutliersView ? "Outliers" : null,
    views.showCollectView ? "Ideas" : null,
    views.showHeadlinesView ? "Headlines" : null,
    views.showAvatarView ? "Avatar" : null,
  ].filter((label): label is string => Boolean(label));
  return labels.length === 1 ? labels[0]! : "Research";
}

function firstEnabledCollectView(views: {
  showOutliersView: boolean;
  showCollectView: boolean;
  showHeadlinesView: boolean;
  showAvatarView: boolean;
}): CollectSubView {
  if (views.showCollectView) return "collect";
  if (views.showOutliersView) return "outliers";
  if (views.showHeadlinesView) return "headlines";
  return "avatar";
}

function isCollectViewEnabled(
  view: CollectSubView,
  views: {
    showOutliersView: boolean;
    showCollectView: boolean;
    showHeadlinesView: boolean;
    showAvatarView: boolean;
  },
): boolean {
  if (view === "outliers") return views.showOutliersView;
  if (view === "collect") return views.showCollectView;
  if (view === "headlines") return views.showHeadlinesView;
  return views.showAvatarView;
}

type CollectPanelProps = {
  items: CollectItem[];
  onItemsChange: (items: CollectItem[]) => void;
  onAddPreviewToNotes?: (preview: string) => void;
  onStartWriting?: (item: CollectItem) => void | Promise<void>;
  showOutliersView?: boolean;
  showCollectView?: boolean;
  showHeadlinesView?: boolean;
  showAvatarView?: boolean;
  workspaceSidebarOpen?: boolean;
  toolsSidebarOpen?: boolean;
};

export function CollectPanel({
  items,
  onItemsChange,
  onAddPreviewToNotes,
  onStartWriting,
  showOutliersView = true,
  showCollectView = true,
  showHeadlinesView = true,
  showAvatarView = true,
  workspaceSidebarOpen = true,
  toolsSidebarOpen = true,
}: CollectPanelProps) {
  const views = { showOutliersView, showCollectView, showHeadlinesView, showAvatarView };
  const enabledCount =
    Number(showOutliersView) +
    Number(showCollectView) +
    Number(showHeadlinesView) +
    Number(showAvatarView);

  const [activeCollectView, setActiveCollectView] = useState<CollectSubView>(() =>
    firstEnabledCollectView(views),
  );
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [notionConnected, setNotionConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() =>
    readNotionIdeasLastSyncedAt(),
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!isCollectViewEnabled(activeCollectView, views)) {
      setActiveCollectView(firstEnabledCollectView(views));
    }
  }, [activeCollectView, showOutliersView, showCollectView, showHeadlinesView, showAvatarView]);

  const syncFromNotion = useCallback(async () => {
    if (!isTauriRuntime()) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const pages = await queryNotionIdeaPages();
      onItemsChange(mergeNotionIdeasIntoCollectItems(itemsRef.current, pages));
      const now = Date.now();
      writeNotionIdeasLastSyncedAt(now);
      setLastSyncedAt(now);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSyncing(false);
    }
  }, [onItemsChange]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    void (async () => {
      try {
        const config = await getNotionIdeasConfig();
        if (!cancelled) setNotionConnected(config.connected);
      } catch {
        if (!cancelled) setNotionConnected(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeCollectView]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  /** Ideas are Notion-sourced only — hide any legacy local rows. */
  const ideaItems = useMemo(
    () => items.filter((item) => Boolean(item.notionPageId)),
    [items],
  );

  useEffect(() => {
    if (activeCollectView !== "collect" || !showCollectView) return;
    if (!items.some((item) => !item.notionPageId)) return;
    onItemsChange(items.filter((item) => Boolean(item.notionPageId)));
  }, [activeCollectView, showCollectView, items, onItemsChange]);

  const activeItem = useMemo(
    () => ideaItems.find((item) => item.id === activeItemId) ?? null,
    [ideaItems, activeItemId],
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
          {enabledCount > 1 ? (
            <CollectSubViewTabs
              activeView={activeCollectView}
              onViewChange={setActiveCollectView}
              showOutliersView={showOutliersView}
              showCollectView={showCollectView}
              showHeadlinesView={showHeadlinesView}
              showAvatarView={showAvatarView}
            />
          ) : (
            <h2 className="text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-ink">
              {soleCollectViewTitle(views)}
            </h2>
          )}
        </header>

        {activeCollectView === "avatar" && showAvatarView ? (
          <AvatarView />
        ) : activeCollectView === "headlines" && showHeadlinesView ? (
          <HeadlinesView
            workspaceSidebarOpen={workspaceSidebarOpen}
            toolsSidebarOpen={toolsSidebarOpen}
          />
        ) : activeCollectView === "collect" && showCollectView ? (
        <div className="harvy-notion-db mt-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-[12px] text-muted/65 dark:text-white/45">
                {notionConnected ? (
                  <>
                    {isSyncing
                      ? "Syncing from Notion…"
                      : lastSyncedAt
                        ? `Synced ${formatFetchedAgo(lastSyncedAt)}`
                        : "Notion connected"}
                    {syncError ? (
                      <span className="ml-2 text-red-600/90 dark:text-red-400/90">{syncError}</span>
                    ) : null}
                  </>
                ) : (
                  "Connect Notion in Settings → Research to pull ideas from your database."
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 ? (
                  <CollectSelectionActions
                    selectedCount={selectedIds.size}
                    onDelete={removeSelectedItems}
                    onAddToNotes={handleAddSelectedToNotes}
                  />
                ) : null}
                {notionConnected ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-muted/70 transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-50 dark:text-white/50 dark:hover:bg-white/[0.06] dark:hover:text-white"
                    disabled={isSyncing}
                    onClick={() => void syncFromNotion()}
                  >
                    <RefreshCw
                      size={13}
                      strokeWidth={2}
                      className={isSyncing ? "animate-spin" : undefined}
                      aria-hidden
                    />
                    Sync
                  </button>
                ) : null}
              </div>
            </div>

            <div className="harvy-notion-db-frame">
              <table className="harvy-notion-db-table">
                <thead>
                  <tr>
                    <th className="harvy-notion-db-th harvy-notion-db-th--name">
                      <span className="harvy-notion-db-th-inner">
                        <TypeIcon size={13} strokeWidth={1.75} aria-hidden />
                        Name
                      </span>
                    </th>
                    <th className="harvy-notion-db-th harvy-notion-db-th--check" />
                  </tr>
                </thead>
                <tbody>
                  {ideaItems.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="harvy-notion-db-empty">
                        {notionConnected
                          ? 'No pages with Status “Idea”. Add one in Notion, then Sync.'
                          : "Connect Notion in Settings → Research to load ideas."}
                      </td>
                    </tr>
                  ) : (
                    ideaItems.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <tr
                          key={item.id}
                          className={`harvy-notion-db-row group ${isSelected ? "is-selected" : ""}`}
                          onClick={() => openItem(item.id)}
                        >
                          <td className="harvy-notion-db-td harvy-notion-db-td--name">
                            <div className="flex min-w-0 items-center gap-2">
                              <FileText
                                size={15}
                                strokeWidth={1.6}
                                className="harvy-notion-page-icon shrink-0"
                                aria-hidden
                              />
                              <span
                                className={`min-w-0 flex-1 truncate text-[14px] ${
                                  item.preview.trim()
                                    ? "text-ink dark:text-white/90"
                                    : "text-muted/50 dark:text-white/35"
                                }`}
                              >
                                {item.preview.trim() || "Untitled"}
                              </span>
                              <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                {onStartWriting ? (
                                  <button
                                    type="button"
                                    className="harvy-notion-row-action"
                                    aria-label="Start writing"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void onStartWriting(item);
                                    }}
                                  >
                                    Write
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="harvy-notion-row-action"
                                  aria-label="Open idea"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openItem(item.id);
                                  }}
                                >
                                  Open
                                </button>
                              </div>
                            </div>
                          </td>
                          <td
                            className="harvy-notion-db-td harvy-notion-db-td--check"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <CollectRowCheckbox
                              checked={isSelected}
                              onToggle={() => toggleSelected(item.id)}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
        </div>
        ) : showOutliersView ? (
          <OutliersView
            onAddToNotes={onAddPreviewToNotes}
            workspaceSidebarOpen={workspaceSidebarOpen}
            toolsSidebarOpen={toolsSidebarOpen}
          />
        ) : showHeadlinesView ? (
          <HeadlinesView
            workspaceSidebarOpen={workspaceSidebarOpen}
            toolsSidebarOpen={toolsSidebarOpen}
          />
        ) : showAvatarView ? (
          <AvatarView />
        ) : null}
      </WorkspaceSectionMainContent>

      <CollectItemModal
        open={activeItemId !== null}
        item={activeItem}
        onClose={() => setActiveItemId(null)}
        onUpdateItem={updateItem}
        onStartWriting={
          onStartWriting
            ? (item) => {
                setActiveItemId(null);
                void onStartWriting(item);
              }
            : undefined
        }
      />
    </>
  );
}
