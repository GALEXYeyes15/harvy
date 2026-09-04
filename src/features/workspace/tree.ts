import type { FileNode } from "./types";
import { posixSegmentToFinderName } from "./finderFileNames";

/** Shared with editor uploads — keep list aligned with `imageAssets.ts`. */
export const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "heic",
  "heif",
  "bmp",
  "tif",
  "tiff",
] as const;

/** Files shown in the workspace sidebar (directories always pass through when they have visible children). */
export const ALLOWED_EXTENSIONS = [
  "pdf",
  "txt",
  "md",
  "markdown",
  "mkd",
  "harvy",
  ...IMAGE_EXTENSIONS,
] as const;

function getExtension(name: string): string | null {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) return null;
  return name.slice(dotIndex + 1).toLowerCase();
}

function isAllowedFile(name: string): boolean {
  const extension = getExtension(name);
  return extension ? ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number]) : false;
}

/** Numeric-aware name compare so `6/7` sorts before `6/14`. */
export function compareNaturalNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function compareWorkspaceNodes(a: FileNode, b: FileNode): number {
  if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
  return compareNaturalNames(a.name, b.name);
}

export function filterFileTree(nodes: FileNode[]): FileNode[] {
  const next = nodes.reduce<FileNode[]>((acc, node) => {
    if (node.kind === "file") {
      if (isAllowedFile(node.name)) {
        acc.push({ ...node });
      }
      return acc;
    }

    const filteredChildren = filterFileTree(node.children ?? []);
    // Keep directories even when empty so new folders and empty dirs stay visible.
    acc.push({ ...node, children: filteredChildren });
    return acc;
  }, []);
  next.sort(compareWorkspaceNodes);
  return next;
}

export function isTextPreviewable(path: string): boolean {
  const extension = getExtension(path.split(/[\\/]/).pop() ?? path);
  return (
    extension === "txt" ||
    extension === "md" ||
    extension === "markdown" ||
    extension === "mkd" ||
    extension === "harvy"
  );
}

export function isImagePreviewable(path: string): boolean {
  const extension = getExtension(path.split(/[\\/]/).pop() ?? path);
  return Boolean(
    extension && IMAGE_EXTENSIONS.includes(extension as (typeof IMAGE_EXTENSIONS)[number]),
  );
}

export function defaultExpandedPaths(root: FileNode): Set<string> {
  const expanded = new Set<string>([root.path]);
  for (const child of root.children ?? []) {
    if (child.kind === "directory") {
      expanded.add(child.path);
    }
  }
  return expanded;
}

export function findNodeByPath(root: FileNode, path: string): FileNode | null {
  if (root.path === path) return root;
  for (const child of root.children ?? []) {
    const found = findNodeByPath(child, path);
    if (found) return found;
  }
  return null;
}

/**
 * Maps folder name segments under the workspace root (`root` = home / workspace root node) to the filesystem
 * path of the deepest folder. Empty → browse at workspace root (`null`).
 */
export function browsePathFromFolderSegments(root: FileNode, folderSegments: string[]): string | null {
  if (folderSegments.length === 0) return null;
  let node: FileNode = root;
  for (const seg of folderSegments) {
    const next = (node.children ?? []).find((c) => c.kind === "directory" && c.name === seg);
    if (!next) return null;
    node = next;
  }
  return node.path;
}

export function filterTree(root: FileNode, query: string): FileNode | null {
  const q = query.trim().toLowerCase();
  if (!q) return root;

  const selfMatch =
    root.name.toLowerCase().includes(q) ||
    posixSegmentToFinderName(root.name).toLowerCase().includes(q);
  if (root.kind === "file") return selfMatch ? root : null;

  const filteredChildren = (root.children ?? [])
    .map((child) => filterTree(child, q))
    .filter((child): child is FileNode => child !== null);

  if (selfMatch || filteredChildren.length > 0) {
    filteredChildren.sort(compareWorkspaceNodes);
    return { ...root, children: filteredChildren };
  }
  return null;
}
