import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isTauriRuntime } from "../features/save/saveRuntime";
import { setWorkspaceImageDragData } from "../features/editor/imageDrop";
import { armSidebarImagePointerDrag } from "../features/editor/sidebarImageDrag";
import { posixSegmentToFinderName } from "../features/workspace/finderFileNames";
import { isImagePreviewable } from "../features/workspace/tree";
import { WorkspaceNodeIcon } from "../features/workspace/nodeIcon";
import type { FileNode } from "../features/workspace/types";

/** Unselected row chrome — reused by `SidebarLeft` folder title row for matching hover/padding. */
export const WORKSPACE_ROW_SHELL_UNSELECTED =
  "flex w-full min-w-0 items-center rounded-md px-2 py-[5px] text-[12px] text-muted/90 transition-colors duration-100 ease-out hover:bg-ink/[0.035] hover:text-ink";

const WORKSPACE_ROW_SHELL_SELECTED =
  "relative flex w-full min-w-0 items-center rounded-md bg-muted/[0.14] px-2 py-[5px] text-[12px] text-muted/90";

type WorkspaceTreeProps = {
  node: FileNode;
  depth?: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  /** Deepest visible folder or file on the way to the open document. */
  openDocumentTrailPath?: string | null;
  /** Path of the row currently hovered in the workspace list (lifted to sidebar for single-source truth). */
  hoveredRowPath: string | null;
  onWorkspaceRowPointerEnter: (path: string) => void;
  onWorkspaceRowPointerLeave: (path: string) => void;
  onToggleFolder: (path: string) => void;
  onSelectNode: (node: FileNode) => void;
  /** Navigate into this folder (sidebar); folders only. */
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
const ICON_GUTTER = 6;
const FOLDER_ANIMATION_MS = 500;

export function WorkspaceTree({
  node,
  depth = 0,
  expandedPaths,
  selectedPath,
  openDocumentTrailPath = null,
  hoveredRowPath,
  onWorkspaceRowPointerEnter,
  onWorkspaceRowPointerLeave,
  onToggleFolder,
  onSelectNode,
  onOpenFolder,
  renamingPath = null,
  renameDraft = "",
  onRenameDraftChange = () => {},
  onRenameCommit = () => {},
  onRenameCancel = () => {},
}: WorkspaceTreeProps) {
  const isDirectory = node.kind === "directory";
  const isExpanded = isDirectory ? expandedPaths.has(node.path) : false;
  const isSelected = selectedPath === node.path;
  const isOpenDocumentTrail = openDocumentTrailPath === node.path;
  const isRenaming = Boolean(isDirectory && renamingPath === node.path);
  const isDraggableImage = !isDirectory && isImagePreviewable(node.path);
  const displayName = posixSegmentToFinderName(node.name);

  const rowShell = isOpenDocumentTrail
    ? WORKSPACE_ROW_SHELL_SELECTED
    : `relative overflow-hidden ${WORKSPACE_ROW_SHELL_UNSELECTED}`;

  const renameShell = `${rowShell} ring-1 ring-ink/12 ring-offset-0 ring-offset-transparent dark:ring-white/[0.08]`;

  const renameInputRef = useRef<HTMLInputElement>(null);
  const isThisRowHovered = hoveredRowPath === node.path;
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

  return (
    <li>
      {isRenaming ? (
        <div
          className={renameShell}
          style={{ paddingLeft }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="relative inline-flex size-[13px] shrink-0 items-center justify-center">
              <WorkspaceNodeIcon node={node} isExpanded={isExpanded} />
            </span>
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
          <div className="h-6 w-10 shrink-0" aria-hidden />
        </div>
      ) : (
        <div
          className={rowShell}
          onMouseEnter={() => onWorkspaceRowPointerEnter(node.path)}
          onMouseLeave={() => onWorkspaceRowPointerLeave(node.path)}
        >
          {isOpenDocumentTrail ? (
            <span
              className="pointer-events-none absolute inset-y-1 left-0 w-[2.5px] rounded-full bg-muted"
              aria-hidden
            />
          ) : null}
          <button
            type="button"
            aria-current={isOpenDocumentTrail ? "true" : undefined}
            aria-expanded={isDirectory ? isExpanded : undefined}
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
              if (isDirectory) onToggleFolder(node.path);
              onSelectNode(node);
            }}
            className={`flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left font-inherit text-inherit ${
              isDraggableImage ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
            }`}
            style={{ paddingLeft }}
          >
            {isDirectory ? (
              <span className="relative inline-flex size-[13px] shrink-0 items-center justify-center">
                <span
                  className={`absolute inset-0 flex items-center justify-center transition-opacity duration-75 ease-out ${
                    isThisRowHovered ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <WorkspaceNodeIcon node={node} isExpanded={isExpanded} />
                </span>
                <span
                  className={`harvy-workspace-folder-chevron absolute inset-0 flex items-center justify-center font-mono text-[11px] leading-none ${
                    isThisRowHovered ? "opacity-100" : "opacity-0"
                  } ${
                    isSelected ? "text-muted/80" : "text-muted/50"
                  } ${isExpanded ? "rotate-90" : "rotate-0"}`}
                  aria-hidden
                >
                  &gt;
                </span>
              </span>
            ) : (
              <WorkspaceNodeIcon node={node} isExpanded={isExpanded} />
            )}
            <span
              className={`min-w-0 flex-1 truncate leading-snug ${isOpenDocumentTrail ? "font-medium" : ""}`}
            >
              {displayName}
            </span>
          </button>
          <div className="flex h-6 w-10 shrink-0 items-center justify-end">
            {isDirectory && onOpenFolder ? (
              <button
                type="button"
                aria-label={`Open folder ${displayName}`}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium text-muted/65 transition-opacity duration-75 ease-out hover:bg-ink/[0.06] hover:text-ink ${
                  isThisRowHovered
                    ? "visible opacity-100 pointer-events-auto"
                    : "invisible opacity-0 pointer-events-none"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenFolder(node);
                }}
              >
                Open
              </button>
            ) : null}
          </div>
        </div>
      )}

      {isDirectory && hasChildren && renderChildren ? (
        <div
          className={`harvy-workspace-folder-children ${
            childrenOpen ? "harvy-workspace-folder-children--open" : ""
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <ul className="mt-0.5 space-y-0.5">
              {childNodes.map((child) => (
                <WorkspaceTree
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  expandedPaths={expandedPaths}
                  selectedPath={selectedPath}
                  openDocumentTrailPath={openDocumentTrailPath}
                  hoveredRowPath={hoveredRowPath}
                  onWorkspaceRowPointerEnter={onWorkspaceRowPointerEnter}
                  onWorkspaceRowPointerLeave={onWorkspaceRowPointerLeave}
                  onToggleFolder={onToggleFolder}
                  onSelectNode={onSelectNode}
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
