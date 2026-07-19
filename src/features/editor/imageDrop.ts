import type { Editor } from "@tiptap/core";
import { invoke } from "@tauri-apps/api/core";
import { isImagePreviewable } from "../workspace/tree";
import { toWorkspaceRelativePath } from "../workspace/workspacePaths";
import { isTauriRuntime } from "../save/saveRuntime";
import { insertHarvyImageAtCursor } from "./insertHarvyImage";
import { focusEditorAtClientCoords } from "./editorCanvasFocus";

/** Custom MIME used when dragging workspace images from the sidebar (browser / HTML5 path). */
export const HARVY_WORKSPACE_IMAGE_MIME = "application/x-harvy-workspace-image";
export const HARVY_SIDEBAR_IMAGE_DROP_EVENT = "harvy-sidebar-image-drop";

export type SidebarImageDropDetail = {
  path: string;
  clientX: number;
  clientY: number;
};

/** In-memory drag — required because Tauri's dragDropEnabled blocks HTML5 drops in the webview. */
let activeSidebarImagePath: string | null = null;

export function beginSidebarImageDrag(absolutePath: string): void {
  activeSidebarImagePath = absolutePath;
}

export function endSidebarImageDrag(): void {
  activeSidebarImagePath = null;
}

export function getActiveSidebarImageDragPath(): string | null {
  return activeSidebarImagePath;
}

export function isSidebarImageDragActive(): boolean {
  return activeSidebarImagePath !== null;
}

export function dispatchSidebarImageDrop(path: string, clientX: number, clientY: number): void {
  window.dispatchEvent(
    new CustomEvent<SidebarImageDropDetail>(HARVY_SIDEBAR_IMAGE_DROP_EVENT, {
      detail: { path, clientX, clientY },
    }),
  );
}

export function setWorkspaceImageDragData(dataTransfer: DataTransfer, absolutePath: string): void {
  dataTransfer.setData(HARVY_WORKSPACE_IMAGE_MIME, absolutePath);
  dataTransfer.setData("text/plain", `harvy-workspace-image:${absolutePath}`);
  dataTransfer.effectAllowed = "copy";
}

function pathFromPlainText(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith("harvy-workspace-image:")) {
    return trimmed.slice("harvy-workspace-image:".length).trim() || null;
  }
  return null;
}

export function getWorkspaceImagePathFromDataTransfer(dataTransfer: DataTransfer): string | null {
  const mimePath = dataTransfer.getData(HARVY_WORKSPACE_IMAGE_MIME).trim();
  if (mimePath) return mimePath;
  return pathFromPlainText(dataTransfer.getData("text/plain"));
}

function transferTypes(dataTransfer: DataTransfer): string[] {
  return Array.from(dataTransfer.types as unknown as ArrayLike<string>);
}

/** True when the drag payload looks like it can yield one or more images. */
export function dataTransferHasImagePayload(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  if (isSidebarImageDragActive()) return true;
  const types = transferTypes(dataTransfer);
  if (types.includes(HARVY_WORKSPACE_IMAGE_MIME)) return true;
  if (dataTransfer.files?.length) {
    return Array.from(dataTransfer.files).some((file) => isImagePreviewable(file.name));
  }
  if (types.includes("Files")) return true;
  return false;
}

type FileWithOptionalPath = File & { path?: string };

function absolutePathsFromFileList(files: FileList | null | undefined): string[] {
  if (!files?.length) return [];
  const paths: string[] = [];
  for (const file of Array.from(files)) {
    const path = (file as FileWithOptionalPath).path?.trim();
    if (path && isImagePreviewable(path)) paths.push(path);
  }
  return paths;
}

function imageFilesFromFileList(files: FileList | null | undefined): File[] {
  if (!files?.length) return [];
  return Array.from(files).filter(
    (file) => isImagePreviewable(file.name) || file.type.startsWith("image/"),
  );
}

/**
 * Resolve a filesystem image into a document `src`:
 * - Already in the workspace → store as workspace-relative path
 * - Outside the workspace (Tauri) → copy into `.harvy/assets/`
 */
export async function resolveFilesystemImageSrc(
  absolutePath: string,
  workspaceRoot: string | null,
): Promise<string | null> {
  const trimmed = absolutePath.trim();
  if (!trimmed || !isImagePreviewable(trimmed)) return null;

  if (workspaceRoot) {
    const relative = toWorkspaceRelativePath(workspaceRoot, trimmed);
    if (relative !== null) return relative;
  }

  if (!isTauriRuntime()) return null;

  try {
    return await invoke<string>("import_workspace_image", { sourcePath: trimmed });
  } catch (err) {
    window.alert(err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function resolveBrowserFileSrc(file: File): Promise<string | null> {
  if (!isImagePreviewable(file.name) && !file.type.startsWith("image/")) return null;
  return URL.createObjectURL(file);
}

/** Collect workspace-ready image `src` values from an HTML5 DataTransfer. */
export async function resolveImageSrcsFromDataTransfer(
  dataTransfer: DataTransfer,
  workspaceRoot: string | null,
): Promise<string[]> {
  const workspacePath =
    getWorkspaceImagePathFromDataTransfer(dataTransfer) ?? getActiveSidebarImageDragPath();
  if (workspacePath) {
    const src = await resolveFilesystemImageSrc(workspacePath, workspaceRoot);
    return src ? [src] : [];
  }

  const absolutePaths = absolutePathsFromFileList(dataTransfer.files);
  if (absolutePaths.length > 0) {
    const srcs: string[] = [];
    for (const path of absolutePaths) {
      const src = await resolveFilesystemImageSrc(path, workspaceRoot);
      if (src) srcs.push(src);
    }
    return srcs;
  }

  // In the desktop app, Finder/OS drops arrive via Tauri's drag-drop event (not FileList).
  if (isTauriRuntime()) {
    return [];
  }

  const srcs: string[] = [];
  for (const file of imageFilesFromFileList(dataTransfer.files)) {
    const src = await resolveBrowserFileSrc(file);
    if (src) srcs.push(src);
  }
  return srcs;
}

/** True when HTML5 drop handling should run (browser path / path-bearing files). */
export function shouldHandleHtmlImageDrop(dataTransfer: DataTransfer | null): boolean {
  if (isSidebarImageDragActive()) return true;
  if (!dataTransfer) return false;
  const types = transferTypes(dataTransfer);
  if (types.includes(HARVY_WORKSPACE_IMAGE_MIME)) return true;
  if (absolutePathsFromFileList(dataTransfer.files).length > 0) return true;
  if (!isTauriRuntime() && imageFilesFromFileList(dataTransfer.files).length > 0) return true;
  if (!isTauriRuntime() && types.includes("Files")) return true;
  return false;
}

/** Collect workspace-ready image `src` values from Tauri OS file-drop paths. */
export async function resolveImageSrcsFromPaths(
  paths: string[],
  workspaceRoot: string | null,
): Promise<string[]> {
  const srcs: string[] = [];
  for (const path of paths) {
    if (!isImagePreviewable(path)) continue;
    const src = await resolveFilesystemImageSrc(path, workspaceRoot);
    if (src) srcs.push(src);
  }
  return srcs;
}

export function insertImageSrcsAtClientCoords(
  editor: Editor,
  srcs: string[],
  clientX: number,
  clientY: number,
): boolean {
  if (srcs.length === 0) return false;

  focusEditorAtClientCoords(editor.view, clientX, clientY);

  let inserted = false;
  for (const src of srcs) {
    if (insertHarvyImageAtCursor(editor, { src })) inserted = true;
  }
  return inserted;
}
