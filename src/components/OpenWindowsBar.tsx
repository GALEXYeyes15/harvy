import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useCallback } from "react";
import { tabNavLeadingPadding } from "../features/chrome/tabNavChromeInsets";
import type { PageTab } from "../features/tabs/pageTabs";

const TAB_NAV_BTN =
  "flex h-full w-7 shrink-0 items-center justify-center rounded text-accent/50 transition-colors hover:bg-ink/[0.04] hover:text-accent/85 disabled:pointer-events-none disabled:opacity-25";

/** Single `transition-property` so `margin-left` isn’t dropped when also transitioning chrome `background-color`. */
const RAIL_AND_CHROME_BG =
  "transition-[margin-left,background-color] duration-500 ease-in-out";

const LEADING_PAD_SYNC = "transition-[padding-left] duration-500 ease-in-out";

type OpenWindowsBarProps = {
  tabs: PageTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCreateTab: () => void;
  /** Shared focus-mode state; when hidden, blend chrome toward editor canvas color. */
  chromeHidden?: boolean;
  /** When true, tab strip starts after the 260px workspace rail (same transition as rail). */
  workspaceSidebarOpen: boolean;
  /** When false (narrow “push” layout), the rail sits in document flow — no left margin on the tab strip. */
  overlayWorkspaceRail?: boolean;
  /** Fullscreen vs windowed — affects tab nav inset when sidebar is collapsed (toggle is fixed separately). */
  isWindowFullscreen?: boolean;
};

export function OpenWindowsBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCreateTab,
  chromeHidden,
  workspaceSidebarOpen,
  overlayWorkspaceRail = true,
  isWindowFullscreen = false,
}: OpenWindowsBarProps) {
  const leadingNavPadding = tabNavLeadingPadding(workspaceSidebarOpen, isWindowFullscreen);

  const goPrevTab = useCallback(() => {
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    if (idx === -1) {
      onSelectTab(tabs[tabs.length - 1]!.id);
      return;
    }
    const prev = idx === 0 ? tabs.length - 1 : idx - 1;
    onSelectTab(tabs[prev]!.id);
  }, [tabs, activeTabId, onSelectTab]);

  const goNextTab = useCallback(() => {
    if (tabs.length === 0) return;
    const idx = tabs.findIndex((t) => t.id === activeTabId);
    if (idx === -1) {
      onSelectTab(tabs[0]!.id);
      return;
    }
    const next = idx >= tabs.length - 1 ? 0 : idx + 1;
    onSelectTab(tabs[next]!.id);
  }, [tabs, activeTabId, onSelectTab]);

  const tabNavDisabled = tabs.length === 0;

  return (
    <div
      className={`flex min-w-0 shrink-0 flex-col transition-colors duration-500 ease-in-out ${
        chromeHidden ? "bg-stage" : "bg-mist"
      }`}
      data-harvy-window-drag
    >
      <header
        className={`harvy-title-bar-drag harvy-tab-strip relative flex h-[var(--harvy-tab-bar-height)] w-full min-w-0 shrink-0 flex-row items-stretch ${RAIL_AND_CHROME_BG} ${
          chromeHidden ? "harvy-tab-strip--stage bg-stage" : "bg-mist"
        } ${overlayWorkspaceRail && workspaceSidebarOpen ? "ml-[260px]" : "ml-0"}`}
        data-harvy-window-drag
      >
        {/* Padding box is itself the drag target for the gap left of the arrows. */}
        <div
          className={`harvy-tab-nav flex h-full shrink-0 items-stretch gap-px ${LEADING_PAD_SYNC}`}
          style={{ paddingLeft: leadingNavPadding }}
          data-harvy-window-drag
        >
          <button
            type="button"
            className={TAB_NAV_BTN}
            aria-label="Previous tab"
            disabled={tabNavDisabled}
            onClick={goPrevTab}
          >
            <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
          </button>
          <button
            type="button"
            className={TAB_NAV_BTN}
            aria-label="Next tab"
            disabled={tabNavDisabled}
            onClick={goNextTab}
          >
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </button>
        </div>

        {/* Trailing empty flex space is the drag target for the right side of the bar. */}
        <div className="flex min-h-0 min-w-0 flex-1 items-stretch" data-harvy-window-drag>
          <div className="h-full max-w-full min-w-0 overflow-x-auto overflow-y-visible overscroll-x-contain whitespace-nowrap [mask-image:linear-gradient(90deg,#000_0%,#000_calc(100%-1rem),transparent)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div
              className="relative flex h-full w-max min-h-0 min-w-0 flex-nowrap items-stretch pb-0 pr-2 pt-0"
              role="tablist"
              aria-label="Open pages"
            >
              {tabs.map((item) => {
                const active = item.id === activeTabId;
                return (
                  <div
                    key={item.id}
                    className={
                      active
                        ? "harvy-page-tab harvy-page-tab--active relative z-10 box-border flex w-[160px] shrink-0 items-stretch rounded-t-none rounded-b-none bg-stage pl-0 pr-2"
                        : "harvy-page-tab harvy-page-tab--idle relative z-0 flex w-[160px] shrink-0 items-stretch rounded-none bg-transparent pr-2 text-muted/40 transition-colors hover:text-muted/80"
                    }
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      id={`harvy-tab-${item.id}`}
                      onClick={() => onSelectTab(item.id)}
                      className={
                        active
                          ? "flex min-w-0 flex-1 items-center overflow-hidden py-0.5 pl-3.5 pr-2 text-left text-[13px] font-semibold leading-tight text-ink/92"
                          : "flex min-w-0 flex-1 items-center overflow-hidden py-0.5 pl-3.5 pr-2 text-left text-[13px] font-semibold leading-tight"
                      }
                    >
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {item.isDirty ? (
                        <span className="ml-1 shrink-0 text-muted/70" aria-label="Unsaved changes">
                          •
                        </span>
                      ) : null}
                    </button>
                    <span className="harvy-page-tab-fade" aria-hidden />
                    <button
                      type="button"
                      aria-label={`Close ${item.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(item.id);
                      }}
                      className={`harvy-page-tab-close absolute top-1/2 right-1 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md hover:bg-ink/[0.08] focus-visible:opacity-100 focus-visible:pointer-events-auto ${
                        active
                          ? "text-accent/70 hover:text-accent"
                          : "text-accent/40 hover:text-accent/70"
                      }`}
                    >
                      <X size={16} strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                aria-label="Create new page"
                onClick={onCreateTab}
                className="flex w-8 shrink-0 items-center justify-center text-accent/60 transition-colors hover:bg-ink/[0.04] hover:text-accent"
              >
                <Plus size={16} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
