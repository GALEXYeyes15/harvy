import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isTauriRuntime } from "../features/save/saveRuntime";
import { setWorkspaceImageDragData } from "../features/editor/imageDrop";
import { armSidebarImagePointerDrag } from "../features/editor/sidebarImageDrag";
import { posixSegmentToFinderName } from "../features/workspace/finderFileNames";
import { isImagePreviewable } from "../features/workspace/tree";
import { WorkspaceFolderChevron, WorkspaceNodeIcon } from "../features/workspace/nodeIcon";
import type { FileNode } from "../features/workspace/types";

/** Unselected row chrome — reused by `SidebarLeft` folder title row for matching hover/padding. */
export const WORKSPACE_ROW_SHELL_UNSELECTED =
  "flex w-full min-w-0 items-center rounded-md px-2 py-[10px] text-[12px] text-muted/90 transition-colors duration-100 ease-out hover:bg-ink/[0.035] hover:text-ink";

const WORKSPACE_ROW_SHELL_SELECTED =
  "relative flex w-full min-w-0 items-center rounded-md bg-muted/[0.14] px-2 py-[10px] text-[12px] text-muted/90";

type WorkspaceTreeProps = {
  node: FileNode;
  depth?: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  /** Deepest visible folder or file on the way to the open document. */
  openDocumentTrailPath?: string | null;
  onToggleFolder: (path: string) => void;
  onSelectNode: (node: FileNode) => void;
  /** Open this search hit and highlight the current query in the editor. */
  onRevealSearchHit?: (node: FileNode) => void;
  /** Navigate into this folder (sidebar); folders only. Double-click, like Finder. */
  onOpenFolder?: (node: FileNode) => void;
  /** Inline folder rename (path matches this directory row). */
  renamingPath?: string | null;
  renameDraft?: string;
  onRenameDraftChange?: (value: string) => void;
  onRenameCommit?: () => void;
  onRenameCancel?: () => void;
};

const DEPTH_STEP = 14;
/** Extra inset so the open-document bar isn’t flush against the icon column. */
const ICON_GUTTER = 18;
const FOLDER_ANIMATION_MS = 500;

function WorkspaceFolderDisclosure({
  name,
  path,
  isExpanded,
  onToggleFolder,
}: {
  name: string;
  path: string;
  isExpanded: boolean;
  onToggleFolder: (path: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={isExpanded ? `Collapse ${name}` : `Expand ${name}`}
      aria-expanded={isExpanded}
      className="-ml-3.5 inline-flex w-3.5 shrink-0 items-center justify-center self-stretch text-muted/55 hover:text-muted"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleFolder(path);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <WorkspaceFolderChevron expanded={isExpanded} />
    </button>
  );
}

export function WorkspaceTree({
  node,
  depth = 0,
  expandedPaths,
  selectedPath,
  openDocumentTrailPath = null,
  onToggleFolder,
  onSelectNode,
  onRevealSearchHit,
  onOpenFolder,
  renamingPath = null,
  renameDraft = "",
  onRenameDraftChange = () => {},
  onRenameCommit = () => {},
  onRenameCancel = () => {},
}: WorkspaceTreeProps) {
  const isDirectory = node.kind === "directory";
  const isExpanded = isDirectory ? expandedPaths.has(node.path) : false;
  const isOpenDocumentTrail = openDocumentTrailPath === node.path;
  const isRenaming = Boolean(isDirectory && renamingPath === node.path);
  const isDraggableImage = !isDirectory && isImagePreviewable(node.path);
  const displayName = posixSegmentToFinderName(node.name);

  const rowShell = isOpenDocumentTrail
    ? WORKSPACE_ROW_SHELL_SELECTED
    : `relative ${WORKSPACE_ROW_SHELL_UNSELECTED}`;

  const renameShell = `${rowShell} ring-1 ring-ink/12 ring-offset-0 ring-offset-transparent dark:ring-white/[0.08]`;

  const renameInputRef = useRef<HTMLInputElement>(null);
  const [renderChildren, setRenderChildren] = useState(isExpanded);
  const [childrenOpen, setChildrenOpen] = useState(isExpanded);

  useLayoutEffect(() => {
    if (!isRenaming || !renameInputRef.current) return;
    const el = renameInputRef.current;
    el.focus();
    el.select();
  }, [isRenaming]);

  useLayoutEffect(() => {
    if (!isDirectory) return;
    if (isExpanded) {
      setRenderChildren(true);
      const frame = requestAnimationFrame(() => setChildrenOpen(true));
      return () => cancelAnimationFrame(frame);
    }
    setChildrenOpen(false);
  }, [isDirectory, isExpanded]);

  useEffect(() => {
    if (!isDirectory || isExpanded) return;
    const timer = window.setTimeout(() => setRenderChildren(false), FOLDER_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [isDirectory, isExpanded]);

  const paddingLeft = depth * DEPTH_STEP + ICON_GUTTER;
  const childNodes = node.children ?? [];
  const hasChildren = childNodes.length > 0;

  const disclosure = isDirectory ? (
    <WorkspaceFolderDisclosure
      name={displayName}
      path={node.path}
      isExpanded={isExpanded}
      onToggleFolder={onToggleFolder}
    />
  ) : null;

  const nodeIcon = (
    <span className="inline-flex size-[13px] shrink-0 items-center justify-center">
      <WorkspaceNodeIcon node={node} />
    </span>
  );

  return (
    <li>
      {isRenaming ? (
        <div
          className={renameShell}
          style={{ paddingLeft }}
          onClick={(e) => e.stopPropagation()}
        >
          {disclosure}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {nodeIcon}
            <input
              ref={renameInputRef}
              type="text"
              value={renameDraft}
              aria-label="Folder name"
              className="min-w-0 flex-1 rounded-md border-0 bg-canvas/55 px-1.5 py-0.5 text-[12px] text-ink outline-none ring-1 ring-line/25 transition-shadow focus:ring-ink/20 dark:bg-canvas/25 dark:ring-white/10 dark:focus:ring-white/15"
              onChange={(e) => onRenameDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onRenameCommit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  onRenameCancel();
                }
              }}
              onBlur={() => {
                onRenameCommit();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      ) : (
        <div className={`${rowShell} group`} style={{ paddingLeft }}>
          {isOpenDocumentTrail ? (
            <span
              className="pointer-events-none absolute inset-y-1 left-0 w-[2.5px] rounded-full bg-muted"
              aria-hidden
            />
          ) : null}
          {disclosure}
          <button
            type="button"
            aria-current={isOpenDocumentTrail ? "true" : undefined}
            // HTML5 drag works in the browser; desktop uses pointer drag (Tauri blocks HTML5 drops).
            draggable={isDraggableImage && !isTauriRuntime()}
            onDragStart={(event) => {
              if (!isDraggableImage || !event.dataTransfer || isTauriRuntime()) return;
              setWorkspaceImageDragData(event.dataTransfer, node.path);
            }}
            onPointerDown={(event) => {
              if (!isDraggableImage || !isTauriRuntime()) return;
              armSidebarImagePointerDrag(event.nativeEvent, node.path, node.name);
            }}
            onClick={() => {
              onSelectNode(node);
            }}
            onDoubleClick={(event) => {
              if (!isDirectory || !onOpenFolder) return;
              event.preventDefault();
              onOpenFolder(node);
            }}
            className={`flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left font-inherit text-inherit ${
              isDraggableImage ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
            }`}
          >
            {nodeIcon}
            <span
              className={`min-w-0 flex-1 truncate leading-snug ${isOpenDocumentTrail ? "font-medium" : ""}`}
            >
              {displayName}
            </span>
          </button>
          {typeof node.searchHitCount === "number" ? (
            <button
              type="button"
              data-harvy-search-hit
              aria-label={`Show ${node.searchHitCount} ${node.searchHitCount === 1 ? "match" : "matches"} in ${displayName}`}
              className="harvy-search-hit-count ml-1 shrink-0 cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] font-bold leading-snug text-muted/55"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                (onRevealSearchHit ?? onSelectNode)(node);
              }}
            >
              ({node.searchHitCount} found)
            </button>
          ) : null}
        </div>
      )}

      {isDirectory && hasChildren && renderChildren ? (
        <div
          className={`harvy-workspace-folder-children ${
            childrenOpen ? "harvy-workspace-folder-children--open" : ""
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <ul className="space-y-0.5">
              {childNodes.map((child) => (
                <WorkspaceTree
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  expandedPaths={expandedPaths}
                  selectedPath={selectedPath}
                  openDocumentTrailPath={openDocumentTrailPath}
                  onToggleFolder={onToggleFolder}
                  onSelectNode={onSelectNode}
                  onRevealSearchHit={onRevealSearchHit}
                  onOpenFolder={onOpenFolder}
                  renamingPath={renamingPath}
                  renameDraft={renameDraft}
                  onRenameDraftChange={onRenameDraftChange}
                  onRenameCommit={onRenameCommit}
                  onRenameCancel={onRenameCancel}
                />
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </li>
  );
}
