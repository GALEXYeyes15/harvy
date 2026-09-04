import { ChevronLeft, ChevronRight } from "lucide-react";
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
        className={`harvy-title-bar-drag relative flex h-8 w-full min-w-0 shrink-0 flex-row items-stretch ${RAIL_AND_CHROME_BG} ${
          chromeHidden ? "bg-stage" : "bg-mist"
        } ${overlayWorkspaceRail && workspaceSidebarOpen ? "ml-[260px]" : "ml-0"}`}
        data-harvy-window-drag
      >
        {/* Padding box is itself the drag target for the gap left of the arrows. */}
        <div
          className={`flex h-full shrink-0 items-stretch gap-px ${LEADING_PAD_SYNC}`}
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
            <ChevronLeft size={15} strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            className={TAB_NAV_BTN}
            aria-label="Next tab"
            disabled={tabNavDisabled}
            onClick={goNextTab}
          >
            <ChevronRight size={15} strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        {/* Trailing empty flex space is the drag target for the right side of the bar. */}
        <div className="flex min-h-0 min-w-0 flex-1 items-stretch" data-harvy-window-drag>
          <div className="h-full max-w-full min-w-0 overflow-x-auto overflow-y-visible overscroll-x-contain whitespace-nowrap [mask-image:linear-gradient(90deg,#000_0%,#000_calc(100%-1rem),transparent)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div
              className="relative flex h-full w-max min-h-0 min-w-0 flex-nowrap items-stretch gap-px pb-0 pl-1 pr-2 pt-0"
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
                        ? "group relative z-10 box-border flex w-[160px] shrink-0 items-stretch rounded-t-none rounded-b-none bg-stage pl-0 pr-2"
                        : "group relative z-0 flex w-[160px] shrink-0 items-stretch rounded-none bg-transparent pr-2 text-muted/40 transition-colors hover:bg-ink/[0.03] hover:text-muted/65"
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
                          ? "flex min-w-0 flex-1 items-center overflow-hidden py-0.5 pl-2 pr-2 text-left text-[11px] font-medium leading-tight text-ink/92 group-hover:pr-6 group-focus-within:pr-6"
                          : "flex min-w-0 flex-1 items-center overflow-hidden py-0.5 pl-2 pr-2 text-left text-[11px] font-normal leading-tight group-hover:pr-6 group-focus-within:pr-6"
                      }
                    >
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {item.isDirty ? (
                        <span className="ml-1 shrink-0 text-muted/70" aria-label="Unsaved changes">
                          •
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      aria-label={`Close ${item.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(item.id);
                      }}
                      className={`absolute top-0 right-2 bottom-0 z-10 flex items-center rounded px-1 text-[12px] leading-none opacity-0 pointer-events-none transition hover:bg-ink/[0.06] group-hover:pointer-events-auto group-hover:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 ${
                        active
                          ? "text-accent/70 hover:text-accent"
                          : "text-accent/40 hover:text-accent/70"
                      }`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                aria-label="Create new page"
                onClick={onCreateTab}
                className="flex w-8 shrink-0 items-center justify-center text-[15px] leading-none text-accent/60 transition-colors hover:bg-ink/[0.04] hover:text-accent"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
