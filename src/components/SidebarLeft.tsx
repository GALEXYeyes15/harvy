import { Fragment, useCallback, useState } from "react";
import { FolderOpen, FolderPlus, Settings } from "lucide-react";
import { APP_NAME } from "../lib/constants";
import { WorkspaceTree, WORKSPACE_ROW_SHELL_UNSELECTED } from "./WorkspaceTree";
import type { FileNode } from "../features/workspace/types";

/** Overline / micro-label — consistent with tools panel */
const OVERLINE = "text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/50";

const CRUMB_BTN =
  "max-w-[min(100%,7rem)] truncate rounded px-0.5 text-left text-muted/55 transition-colors hover:bg-ink/[0.04] hover:text-muted sm:max-w-[10rem]";

function getDisplayBreadcrumbs(volumeLabel: string, rootDisplay: string, folderSegments: string[]) {
  if (!folderSegments.length) return [volumeLabel, rootDisplay];
  return [volumeLabel, "...", folderSegments[folderSegments.length - 1]!];
}

/** Breadcrumb: drive root only, or `drive / folder`, or `drive / … / leaf`. Full path stays in `title`. */
function ShortWorkspaceBreadcrumb({
  volumeLabel,
  rootDisplay,
  folderSegments,
  onNavigate,
}: {
  volumeLabel: string;
  rootDisplay: string;
  folderSegments: string[];
  onNavigate: (displayIndex: number) => void;
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
              <span className="shrink-0 text-muted/40" aria-hidden>
                ...
              </span>
            ) : !isLast ? (
              <button type="button" className={CRUMB_BTN} onClick={() => onNavigate(displayIndex)}>
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
  expandedPaths: Set<string>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onToggleFolder: (path: string) => void;
  onSelectNode: (node: FileNode) => void;
  onOpenFolder: (node: FileNode) => void;
  onBreadcrumbNavigate: (segmentIndex: number) => void;
  onWorkspaceNavigateUp: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  /** Create a new folder on disk under the current sidebar directory (desktop only). */
  onCreateFolder?: () => void | Promise<void>;
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
  expandedPaths,
  searchQuery,
  onSearchChange,
  onToggleFolder,
  onSelectNode,
  onOpenFolder,
  onBreadcrumbNavigate,
  onWorkspaceNavigateUp,
  onOpenSettings,
  onOpenAbout,
  onCreateFolder,
  folderRenamePath = null,
  folderRenameDraft = "",
  onFolderRenameDraftChange = () => {},
  onFolderRenameCommit = () => {},
  onFolderRenameCancel = () => {},
}: SidebarLeftProps) {
  /** Single hovered workspace row (by path) so only one row shows the “Open” action at a time. */
  const [hoveredWorkspaceRowPath, setHoveredWorkspaceRowPath] = useState<string | null>(null);
  const onWorkspaceRowPointerEnter = useCallback((path: string) => {
    setHoveredWorkspaceRowPath(path);
  }, []);
  const onWorkspaceRowPointerLeave = useCallback((path: string) => {
    setHoveredWorkspaceRowPath((current) => (current === path ? null : current));
  }, []);

  const isWorkspaceRoot = breadcrumbFolderSegments.length === 0;
  const currentFolderTitle = isWorkspaceRoot
    ? breadcrumbRootDisplayLabel
    : breadcrumbFolderSegments[breadcrumbFolderSegments.length - 1]!;
  /** UI-only; breadcrumb state unchanged. */
  const displayFolderTitle = currentFolderTitle ? `/${currentFolderTitle}` : "";
  const canStepUpWorkspace = !isWorkspaceRoot;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col self-stretch bg-stage">
      {/* Same vertical band as the global sidebar toggle (h-8); keeps header copy below the control */}
      <div className="h-8 w-full shrink-0" data-harvy-window-drag aria-hidden />

      <div className="flex shrink-0 flex-col items-stretch pb-3 pl-[var(--harvy-sidebar-content-inset)] pr-2.5 pt-1">
        <p className={OVERLINE}>Workspace</p>
        <p className="mt-1.5 truncate text-[15px] font-semibold tracking-tight text-ink">{APP_NAME}</p>
        <input
          id="harvy-workspace-search"
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search…"
          className="mt-3 w-full rounded-md border-0 bg-mist px-2.5 py-2 text-[12px] text-ink placeholder:text-muted/65"
          aria-label="Search documents"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-[var(--harvy-sidebar-content-inset)] pr-2.5 pb-2 pt-1">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <nav
              aria-label="Workspace path"
              className="min-w-0 flex-1 truncate text-[10px] font-normal leading-relaxed tracking-wide text-muted/55"
              title={[breadcrumbVolumeLabel, breadcrumbRootDisplayLabel, ...breadcrumbFolderSegments].join(" / ")}
            >
              <ShortWorkspaceBreadcrumb
                volumeLabel={breadcrumbVolumeLabel}
                rootDisplay={breadcrumbRootDisplayLabel}
                folderSegments={breadcrumbFolderSegments}
                onNavigate={onBreadcrumbNavigate}
              />
            </nav>
            <div className="-translate-y-px flex shrink-0 items-center">
              {workspaceSelected ? (
                <button
                  type="button"
                  title="New Folder"
                  aria-label="New folder"
                  onClick={() => {
                    void onCreateFolder?.();
                  }}
                  className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted/55 transition-[color,background-color] duration-150 ease-in-out hover:bg-ink/[0.07] hover:text-ink/90 dark:hover:bg-white/[0.06] dark:hover:text-white/90"
                >
                  <FolderPlus size={14} strokeWidth={1.5} aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
          <div className={`group/title mt-1 ${WORKSPACE_ROW_SHELL_UNSELECTED}`}>
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
            {!isLoading && workspaceSelected && !loadError && workspaceHasData && workspaceRoots.length === 0 ? (
              <p className="py-2 text-[12px] leading-relaxed text-muted/80">
                {searchQuery.trim() ? "No matching items." : "Nothing to show in this folder."}
              </p>
            ) : null}
            {!isLoading && workspaceSelected && !loadError && workspaceRoots.length > 0 ? (
              <ul className="space-y-0.5">
                {workspaceRoots.map((node) => (
                  <WorkspaceTree
                    key={node.path}
                    node={node}
                    depth={0}
                    expandedPaths={expandedPaths}
                    selectedPath={selectedPath}
                    hoveredRowPath={hoveredWorkspaceRowPath}
                    onWorkspaceRowPointerEnter={onWorkspaceRowPointerEnter}
                    onWorkspaceRowPointerLeave={onWorkspaceRowPointerLeave}
                    onToggleFolder={onToggleFolder}
                    onSelectNode={onSelectNode}
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
