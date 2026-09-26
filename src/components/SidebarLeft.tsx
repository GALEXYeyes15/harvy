import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FolderOpen, Settings } from "lucide-react";
import { APP_NAME } from "../lib/constants";
import { posixSegmentToFinderName } from "../features/workspace/finderFileNames";
import { WorkspaceTree, WORKSPACE_ROW_SHELL_UNSELECTED } from "./WorkspaceTree";
import type { FileNode } from "../features/workspace/types";

const CRUMB_BTN =
  "max-w-[min(100%,7rem)] truncate rounded px-0.5 text-left text-muted/55 transition-colors hover:bg-ink/[0.04] hover:text-muted sm:max-w-[10rem]";

function getDisplayBreadcrumbs(volumeLabel: string, rootDisplay: string, folderSegments: string[]) {
  const finderSegments = folderSegments.map((segment) => posixSegmentToFinderName(segment));
  if (!finderSegments.length) return [volumeLabel, posixSegmentToFinderName(rootDisplay)];
  return [volumeLabel, "...", finderSegments[finderSegments.length - 1]!];
}

type PathFolder = {
  label: string;
  /** Passed to `onNavigate`: 0 is the workspace root, then one step per nested folder. */
  depth: number;
};

function pathFolders(rootDisplay: string, folderSegments: string[]): PathFolder[] {
  return [
    { label: posixSegmentToFinderName(rootDisplay), depth: 0 },
    ...folderSegments.map((segment, index) => ({
      label: posixSegmentToFinderName(segment),
      depth: index + 1,
    })),
  ];
}

/** Collapsed `...` in the path. Hover bolds the mark; click lists the hidden folders. */
function BreadcrumbEllipsis({
  rootDisplay,
  folderSegments,
  onNavigate,
}: {
  rootDisplay: string;
  folderSegments: string[];
  onNavigate: (displayIndex: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const folders = pathFolders(rootDisplay, folderSegments);
  const pathKey = `${rootDisplay}\0${folderSegments.join("\0")}`;

  const placeMenu = () => {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
    const rect = button.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 4;
    if (left + menuRect.width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuRect.width - 8);
    }
    if (top + menuRect.height > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuRect.height - 4);
    }
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  };

  useEffect(() => {
    setOpen(false);
  }, [pathKey]);

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
  }, [open, pathKey]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("resize", placeMenu);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="harvy-path-ellipsis relative inline cursor-pointer border-0 bg-transparent p-0 align-baseline font-[inherit] text-[length:inherit] leading-[inherit] text-inherit"
        aria-label="Show folders in this path"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <span className="harvy-path-ellipsis__label">...</span>
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Folder hierarchy"
              className="harvy-context-menu max-h-64 overflow-y-auto"
              style={{ position: "fixed" }}
            >
              {folders.map((folder) => {
                const isCurrent = folder.depth === folders.length - 1;
                return (
                  <button
                    key={`${folder.depth}-${folder.label}`}
                    type="button"
                    role="menuitem"
                    className={`harvy-context-menu-item block w-full truncate text-left ${
                      isCurrent ? "font-medium text-ink" : ""
                    }`}
                    aria-current={isCurrent ? "page" : undefined}
                    title={folder.label}
                    onClick={() => {
                      if (!isCurrent) onNavigate(folder.depth);
                      setOpen(false);
                    }}
                  >
                    {folder.label}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Breadcrumb: drive root only, or `drive / folder`, or `drive / … / leaf`. Full path stays in `title`. */
function ShortWorkspaceBreadcrumb({
  volumeLabel,
  rootDisplay,
  folderSegments,
  onNavigate,
  onOpenVolumeSettings,
}: {
  volumeLabel: string;
  rootDisplay: string;
  folderSegments: string[];
  onNavigate: (displayIndex: number) => void;
  onOpenVolumeSettings?: () => void;
}) {
  if (!volumeLabel.trim()) return null;

  const sep = (k: string) => (
    <span key={k} className="shrink-0 text-muted/35" aria-hidden>
      {" / "}
    </span>
  );

  const displaySegments = getDisplayBreadcrumbs(volumeLabel, rootDisplay, folderSegments);
  const lastDisplayIndex = displaySegments.length - 1;

  return (
    <>
      {displaySegments.map((segment, displayIndex) => {
        const isEllipsis = segment === "...";
        const isLast = displayIndex === lastDisplayIndex;

        return (
          <Fragment key={`${displayIndex}-${segment}`}>
            {displayIndex > 0 ? sep(`sep-${displayIndex}`) : null}
            {isEllipsis ? (
              <BreadcrumbEllipsis
                rootDisplay={rootDisplay}
                folderSegments={folderSegments}
                onNavigate={onNavigate}
              />
            ) : !isLast ? (
              <button
                type="button"
                className={CRUMB_BTN}
                title={displayIndex === 0 ? "Change workspace folder" : undefined}
                onClick={() => {
                  if (displayIndex === 0) {
                    onOpenVolumeSettings?.();
                    return;
                  }
                  onNavigate(displayIndex);
                }}
              >
                {segment}
              </button>
            ) : (
              <span className="text-muted/60" aria-current="page">
                {segment}
              </span>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

type SidebarLeftProps = {
  workspaceSelected: boolean;
  onChooseFolder?: () => void | Promise<void>;
  workspaceRoots: FileNode[];
  workspaceHasData: boolean;
  breadcrumbVolumeLabel: string;
  breadcrumbRootDisplayLabel: string;
  breadcrumbFolderSegments: string[];
  isLoading: boolean;
  loadError: string | null;
  selectedPath: string | null;
  /** Deepest visible folder or file on the way to the open document. */
  openDocumentTrailPath?: string | null;
  expandedPaths: Set<string>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isSearching?: boolean;
  onToggleFolder: (path: string) => void;
  onSelectNode: (node: FileNode) => void;
  onRevealSearchHit?: (node: FileNode) => void;
  onOpenFolder: (node: FileNode) => void;
  onBreadcrumbNavigate: (segmentIndex: number) => void;
  onWorkspaceNavigateUp: () => void;
  /** Volume crumb (Macintosh HD) opens Settings so the workspace folder can be changed. */
  onOpenVolumeSettings?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  folderRenamePath?: string | null;
  folderRenameDraft?: string;
  onFolderRenameDraftChange?: (value: string) => void;
  onFolderRenameCommit?: () => void;
  onFolderRenameCancel?: () => void;
};

export function SidebarLeft({
  workspaceSelected,
  onChooseFolder,
  workspaceRoots,
  workspaceHasData,
  breadcrumbVolumeLabel,
  breadcrumbRootDisplayLabel,
  breadcrumbFolderSegments,
  isLoading,
  loadError,
  selectedPath,
  openDocumentTrailPath = null,
  expandedPaths,
  searchQuery,
  onSearchChange,
  isSearching = false,
  onToggleFolder,
  onSelectNode,
  onRevealSearchHit,
  onOpenFolder,
  onBreadcrumbNavigate,
  onWorkspaceNavigateUp,
  onOpenVolumeSettings,
  onOpenSettings,
  onOpenAbout,
  folderRenamePath = null,
  folderRenameDraft = "",
  onFolderRenameDraftChange = () => {},
  onFolderRenameCommit = () => {},
  onFolderRenameCancel = () => {},
}: SidebarLeftProps) {
  const isWorkspaceRoot = breadcrumbFolderSegments.length === 0;
  const currentFolderTitle = isWorkspaceRoot
    ? posixSegmentToFinderName(breadcrumbRootDisplayLabel)
    : posixSegmentToFinderName(breadcrumbFolderSegments[breadcrumbFolderSegments.length - 1]!);
  /** UI-only; breadcrumb state unchanged. */
  const displayFolderTitle = currentFolderTitle ? `/${currentFolderTitle}` : "";
  const canStepUpWorkspace = !isWorkspaceRoot;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col self-stretch bg-stage">
      {/* Same vertical band as the global sidebar toggle / tab strip; keeps header copy below the control */}
      <div
        className="h-[var(--harvy-tab-bar-height)] w-full shrink-0"
        data-harvy-window-drag
        aria-hidden
      />

      <div className="flex shrink-0 flex-col items-stretch pb-4 pl-[var(--harvy-sidebar-content-inset)] pr-2.5 pt-1">
        <p className="harvy-app-wordmark truncate text-[21px] font-semibold tracking-tight text-ink">{APP_NAME} Editor</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-[var(--harvy-sidebar-content-inset)] pr-2.5 pb-2 pt-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <nav
              aria-label="Workspace path"
              className="min-w-0 flex-1 truncate text-[11px] font-normal leading-relaxed tracking-wide text-muted/55"
              title={[
                breadcrumbVolumeLabel,
                posixSegmentToFinderName(breadcrumbRootDisplayLabel),
                ...breadcrumbFolderSegments.map((segment) => posixSegmentToFinderName(segment)),
              ].join(" / ")}
            >
              <ShortWorkspaceBreadcrumb
                volumeLabel={breadcrumbVolumeLabel}
                rootDisplay={breadcrumbRootDisplayLabel}
                folderSegments={breadcrumbFolderSegments}
                onNavigate={onBreadcrumbNavigate}
                onOpenVolumeSettings={onOpenVolumeSettings}
              />
            </nav>
          </div>
          <input
            id="harvy-workspace-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search…"
            className="mt-3 w-full rounded-md border-0 bg-mist px-2.5 py-2 text-[12px] text-ink"
            aria-label="Search documents"
          />
          <div className={`group/title mt-3 ${WORKSPACE_ROW_SHELL_UNSELECTED}`}>
            <h2
              className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug tracking-tight text-ink"
              title={displayFolderTitle || undefined}
            >
              {displayFolderTitle}
            </h2>
            <div className="flex h-6 w-10 shrink-0 items-center justify-end">
              {canStepUpWorkspace ? (
                <button
                  type="button"
                  className="pointer-events-none rounded px-1.5 py-0.5 text-[10px] font-medium text-muted/70 opacity-0 transition-opacity duration-150 ease-out hover:bg-ink/[0.06] hover:text-ink group-hover/title:pointer-events-auto group-hover/title:opacity-100 group-focus-within/title:pointer-events-auto group-focus-within/title:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    onWorkspaceNavigateUp();
                  }}
                >
                  Close
                </button>
              ) : (
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium text-muted/70"
                  aria-hidden
                >
                  Root
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto pb-2 pl-[var(--harvy-sidebar-content-inset)] pr-2.5">
            {isLoading ? (
              <p className="py-2 text-[12px] leading-relaxed text-muted/80">Loading workspace…</p>
            ) : null}
            {!isLoading && isSearching ? (
              <p className="py-2 text-[12px] leading-relaxed text-muted/80">Searching…</p>
            ) : null}
            {!isLoading && !workspaceSelected ? (
              <div className="py-3">
                <p className="text-[12px] leading-relaxed text-muted/80">
                  Choose a folder to browse and save your writing files.
                </p>
                <button
                  type="button"
                  onClick={() => void onChooseFolder?.()}
                  className="mt-3 inline-flex items-center gap-2 rounded-md bg-ink/[0.06] px-3 py-2 text-[12px] font-medium text-ink transition-colors hover:bg-ink/[0.1] dark:bg-white/[0.08] dark:hover:bg-white/[0.12]"
                >
                  <FolderOpen size={14} strokeWidth={1.5} aria-hidden />
                  Choose Folder
                </button>
              </div>
            ) : null}
            {!isLoading && workspaceSelected && loadError ? (
              <p className="py-2 text-[12px] leading-relaxed text-muted/80">{loadError}</p>
            ) : null}
            {!isLoading && workspaceSelected && !loadError && !workspaceHasData ? (
              <p className="py-2 text-[12px] leading-relaxed text-muted/80">Workspace is empty.</p>
            ) : null}
            {!isLoading && !isSearching && workspaceSelected && !loadError && workspaceHasData && workspaceRoots.length === 0 ? (
              <p className="py-2 text-[12px] leading-relaxed text-muted/80">
                {searchQuery.trim() ? "No matching items." : "Nothing to show in this folder."}
              </p>
            ) : null}
            {!isLoading && !isSearching && workspaceSelected && !loadError && workspaceRoots.length > 0 ? (
              <ul className="space-y-0.5">
                {workspaceRoots.map((node) => (
                  <WorkspaceTree
                    key={node.path}
                    node={node}
                    depth={0}
                    expandedPaths={expandedPaths}
                    selectedPath={selectedPath}
                    openDocumentTrailPath={openDocumentTrailPath}
                    onToggleFolder={onToggleFolder}
                    onSelectNode={onSelectNode}
                    onRevealSearchHit={onRevealSearchHit}
                    onOpenFolder={onOpenFolder}
                    renamingPath={folderRenamePath}
                    renameDraft={folderRenameDraft}
                    onRenameDraftChange={onFolderRenameDraftChange}
                    onRenameCommit={onFolderRenameCommit}
                    onRenameCancel={onFolderRenameCancel}
                  />
                ))}
              </ul>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-0.5 px-[var(--harvy-sidebar-content-inset)] pr-2.5 pb-2 pt-2">
            <button
              type="button"
              className={`${WORKSPACE_ROW_SHELL_UNSELECTED} justify-start gap-2.5 text-left`}
              aria-label="Tribute"
              onClick={() => onOpenAbout?.()}
            >
              <span
                aria-hidden
                className="inline-flex h-[14px] shrink-0 items-center justify-center text-[12px] leading-none tracking-tight text-muted/60"
                style={{
                  fontFamily:
                    '"Libre Baskerville", Baskerville, "Baskerville Old Face", Palatino, "Palatino Linotype", Georgia, serif',
                }}
              >
                H.
              </span>
              <span className="min-w-0 truncate">Tribute</span>
            </button>
            <button
              type="button"
              className={`${WORKSPACE_ROW_SHELL_UNSELECTED} justify-start gap-2.5 text-left`}
              aria-label="Settings"
              onClick={() => onOpenSettings?.()}
            >
              <Settings size={14} strokeWidth={1.5} className="shrink-0 text-accent/70" aria-hidden />
              <span className="min-w-0 truncate">Settings</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
