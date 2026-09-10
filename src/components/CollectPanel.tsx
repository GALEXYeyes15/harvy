import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { confirm } from "@tauri-apps/plugin-dialog";
import { type CollectItem } from "../features/collect/collectItems";
import {
  COLLECT_SUB_VIEW_LABELS,
  enabledCollectViews,
  firstEnabledCollectView,
  isCollectViewEnabled,
  type CollectSubView,
} from "../features/workspace/collectViews";
import {
  getNotionIdeasConfig,
  mergeNotionIdeasIntoCollectItems,
  queryNotionIdeaPages,
  dismissNotionIdeaPage,
  readNotionIdeasLastSyncedAt,
  writeNotionIdeasLastSyncedAt,
} from "../features/notion/notionIdeas";
import { formatFetchedAgo } from "../features/outliers/outlierPosts";
import { useOutlierColumnCount } from "../features/outliers/useOutlierColumnCount";
import { isTauriRuntime } from "../features/save/saveRuntime";
import { AvatarView } from "./AvatarView";
import { CollectItemModal } from "./CollectItemModal";
import { HeadlinesView } from "./HeadlinesView";
import { OutliersView } from "./OutliersView";
import { WorkspaceSectionMainContent } from "./WorkspaceSectionMainContent";

const SUB_VIEW_TAB =
  "border-0 bg-transparent p-0 text-[1.375rem] font-semibold leading-none tracking-[-0.02em]";

export type { CollectSubView };

function IdeaGalleryCard({
  item,
  onOpen,
}: {
  item: CollectItem;
  onOpen: () => void;
}) {
  const untitled = !item.preview.trim();
  const title = untitled ? "Untitled" : item.preview.trim();
  const notes = (item.body ?? "").trim();

  return (
    <article className="harvy-outlier-card harvy-idea-card relative" onClick={onOpen}>
      <div className="harvy-idea-card-preview">
        {notes ? <p className="harvy-idea-card-preview-text">{notes}</p> : null}
      </div>

      <div className="harvy-idea-card-title">
        <span className={`harvy-idea-card-title-text ${untitled ? "is-untitled" : ""}`}>
          {title}
        </span>
      </div>
    </article>
  );
}

function CollectSubViewTabs({
  activeView,
  onViewChange,
  views,
  collectViewOrder,
}: {
  activeView: CollectSubView;
  onViewChange: (view: CollectSubView) => void;
  views: {
    showOutliersView: boolean;
    showCollectView: boolean;
    showHeadlinesView: boolean;
    showAvatarView: boolean;
  };
  collectViewOrder: CollectSubView[];
}) {
  return (
    <div className="flex items-baseline gap-7" role="tablist" aria-label="Research views">
      {enabledCollectViews(views, collectViewOrder).map((view) => (
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={activeView === view}
          className={`${SUB_VIEW_TAB} text-ink ${
            activeView === view ? "opacity-100" : "opacity-40"
          }`}
          onClick={() => onViewChange(view)}
        >
          {COLLECT_SUB_VIEW_LABELS[view]}
        </button>
      ))}
    </div>
  );
}

function soleCollectViewTitle(views: {
  showOutliersView: boolean;
  showCollectView: boolean;
  showHeadlinesView: boolean;
  showAvatarView: boolean;
}): string {
  const labels = enabledCollectViews(views).map((view) => COLLECT_SUB_VIEW_LABELS[view]);
  return labels.length === 1 ? labels[0]! : "Research";
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
  collectViewOrder?: CollectSubView[];
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
  collectViewOrder,
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
    firstEnabledCollectView(views, collectViewOrder),
  );
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
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
      setActiveCollectView(firstEnabledCollectView(views, collectViewOrder));
    }
  }, [activeCollectView, collectViewOrder, showOutliersView, showCollectView, showHeadlinesView, showAvatarView]);

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

  const { columnCount, isReflowing } = useOutlierColumnCount({
    workspaceSidebarOpen,
    toolsSidebarOpen,
  });

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

  const updateItem = (itemId: string, patch: Partial<CollectItem>) => {
    onItemsChange(
      items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  };

  const openItem = (itemId: string) => {
    setActiveItemId(itemId);
  };

  const deleteItem = async (item: CollectItem) => {
    const title = item.preview.trim() || "Untitled";
    const message = `Delete “${title}” from Ideas?`;
    const ok = isTauriRuntime()
      ? await confirm(message, { title: "Delete idea", kind: "warning" })
      : window.confirm(message);
    if (!ok) return;
    if (item.notionPageId) {
      dismissNotionIdeaPage(item.notionPageId);
    }
    onItemsChange(items.filter((row) => row.id !== item.id));
    setActiveItemId(null);
  };

  return (
    <>
      <WorkspaceSectionMainContent>
        <header className="shrink-0">
          {enabledCount > 1 ? (
            <CollectSubViewTabs
              activeView={activeCollectView}
              onViewChange={setActiveCollectView}
              views={views}
              collectViewOrder={collectViewOrder ?? []}
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
        <div className="mt-7 flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3">
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

            {ideaItems.length === 0 ? (
              <p className="mt-5 text-[13px] text-muted/65">
                {notionConnected
                  ? 'No pages with Status “Idea”. Add one in Notion, then Sync.'
                  : "Connect Notion in Settings → Research to load ideas."}
              </p>
            ) : (
              <div
                className="harvy-idea-gallery mt-5"
                data-reflowing={isReflowing ? "true" : undefined}
                style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
              >
                {ideaItems.map((item) => (
                  <IdeaGalleryCard
                    key={item.id}
                    item={item}
                    onOpen={() => openItem(item.id)}
                  />
                ))}
              </div>
            )}
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
        onDelete={(item) => void deleteItem(item)}
      />
    </>
  );
}
