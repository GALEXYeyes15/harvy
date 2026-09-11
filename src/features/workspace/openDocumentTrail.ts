import type { FileNode } from "./types";
import { normalizeFsPath, toWorkspaceRelativePath } from "./workspacePaths";

/** macOS often exposes the same file as `/Users/...` and `/private/Users/...`. */
export function canonicalComparePath(path: string): string {
  return normalizeFsPath(path)
    .replace(/^\/private(?=\/)/i, "")
    .replace(/^\/System\/Volumes\/Data(?=\/)/i, "");
}

/**
 * Compare paths the way the sidebar needs: ignore `/private`, volume prefixes,
 * letter case, and macOS Finder `/` stored as `:` in POSIX names.
 */
export function comparablePath(path: string): string {
  const trimmed = path.trim();
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }
  const canonical = canonicalComparePath(decoded).normalize("NFC");
  const drive = canonical.match(/^([A-Za-z]):(\/.*)$/);
  if (drive) {
    return `${drive[1].toLowerCase()}:${drive[2]}`.toLowerCase();
  }
  return canonical.replaceAll(":", "/").toLowerCase();
}

function pathSegments(path: string): string[] {
  return comparablePath(path).split("/").filter(Boolean);
}

function segmentsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((seg, i) => seg === b[i]);
}

function segmentsAreSuffix(shorter: string[], longer: string[]): boolean {
  if (shorter.length === 0 || shorter.length > longer.length) return false;
  const start = longer.length - shorter.length;
  return shorter.every((seg, i) => longer[start + i] === seg);
}

function indexOfSegmentSequence(haystack: string[], needle: string[]): number {
  if (needle.length === 0 || needle.length > haystack.length) return -1;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (needle.every((seg, j) => haystack[i + j] === seg)) return i;
  }
  return -1;
}

export function resolveOpenDocumentPath(input: {
  sourcePath?: string | null;
  tabId?: string | null;
  scratchDiskPath?: string | null;
  isVirtualTabId?: (id: string) => boolean;
}): string | null {
  const tab = input.tabId?.trim();
  if (tab && !input.isVirtualTabId?.(tab)) return tab;
  const source = input.sourcePath?.trim();
  if (source) return source;
  const scratch = input.scratchDiskPath?.trim();
  return scratch || null;
}

function workspaceRelative(root: string | null | undefined, path: string): string | null {
  if (!root?.trim()) return null;
  return toWorkspaceRelativePath(comparablePath(root), comparablePath(path));
}

function trailingEqual(a: string[], b: string[], length: number): boolean {
  if (length <= 0 || a.length < length || b.length < length) return false;
  for (let i = 0; i < length; i++) {
    if (a[a.length - length + i] !== b[b.length - length + i]) return false;
  }
  return true;
}

export function isExactOpenDocument(
  nodePath: string,
  openPath: string,
  workspaceRoot?: string | null,
): boolean {
  const nodeSegs = pathSegments(nodePath);
  const openSegs = pathSegments(openPath);
  if (nodeSegs.length === 0 || openSegs.length === 0) return false;
  if (segmentsEqual(nodeSegs, openSegs)) return true;

  const a = workspaceRelative(workspaceRoot, nodePath);
  const b = workspaceRelative(workspaceRoot, openPath);
  if (a != null && b != null && a === b) return true;

  const shorter = nodeSegs.length <= openSegs.length ? nodeSegs : openSegs;
  const longer = nodeSegs.length <= openSegs.length ? openSegs : nodeSegs;
  if (segmentsAreSuffix(shorter, longer)) return true;

  const shared = Math.min(nodeSegs.length, openSegs.length);
  if (shared < 2) return false;
  for (let len = shared; len >= 2; len--) {
    if (!trailingEqual(nodeSegs, openSegs, len)) continue;
    if (len >= 3 || shorter.length === len) return true;
  }
  return false;
}

export function isOpenDocumentInside(
  dirPath: string,
  openPath: string,
  workspaceRoot?: string | null,
): boolean {
  const dirSegs = pathSegments(dirPath);
  const openSegs = pathSegments(openPath);
  if (dirSegs.length === 0 || openSegs.length === 0) return false;

  const a = workspaceRelative(workspaceRoot, dirPath);
  const b = workspaceRelative(workspaceRoot, openPath);
  if (a != null && b != null) {
    if (a === "") return b.length > 0;
    if (b.startsWith(`${a}/`)) return true;
  }

  const fullAt = indexOfSegmentSequence(openSegs, dirSegs);
  if (fullAt >= 0 && fullAt + dirSegs.length < openSegs.length) return true;

  const minLen = dirSegs.length >= 2 ? 2 : 1;
  for (let len = Math.min(dirSegs.length, openSegs.length - 1); len >= minLen; len--) {
    const suffix = dirSegs.slice(dirSegs.length - len);
    const at = indexOfSegmentSequence(openSegs, suffix);
    if (at >= 0 && at + suffix.length < openSegs.length) return true;
  }
  return false;
}

function subtreeContainsOpenDocument(
  node: FileNode,
  open: string,
  root: string | null,
): boolean {
  if (node.kind !== "directory") {
    return isExactOpenDocument(node.path, open, root);
  }
  if (isOpenDocumentInside(node.path, open, root)) return true;
  return (node.children ?? []).some((child) => subtreeContainsOpenDocument(child, open, root));
}

/** Path of the deepest visible row on the way to the open document, or null. */
export function visibleOpenDocumentTrailPath(
  roots: FileNode[],
  expandedPaths: Set<string>,
  openDocumentPath: string | null,
  workspaceRootPath?: string | null,
): string | null {
  const open = openDocumentPath?.trim();
  if (!open) return null;
  const root = workspaceRootPath ?? null;

  const walk = (node: FileNode): string | null => {
    if (node.kind !== "directory") {
      return isExactOpenDocument(node.path, open, root) ? node.path : null;
    }
    if (!subtreeContainsOpenDocument(node, open, root)) return null;
    if (!expandedPaths.has(node.path)) return node.path;
    for (const child of node.children ?? []) {
      const hit = walk(child);
      if (hit) return hit;
    }
    return node.path;
  };

  for (const node of roots) {
    const hit = walk(node);
    if (hit) return hit;
  }
  return null;
}

/** Deepest visible row on the path to the open document. */
export function marksOpenDocumentTrail(opts: {
  nodePath: string;
  isDirectory: boolean;
  isExpanded: boolean;
  childPaths: string[];
  children?: FileNode[];
  openDocumentPath: string | null;
  workspaceRootPath?: string | null;
}): boolean {
  const open = opts.openDocumentPath?.trim();
  if (!open) return false;
  const root = opts.workspaceRootPath ?? null;

  if (!opts.isDirectory) {
    return isExactOpenDocument(opts.nodePath, open, root);
  }

  const contains =
    isOpenDocumentInside(opts.nodePath, open, root) ||
    (opts.children ?? []).some((child) => subtreeContainsOpenDocument(child, open, root));
  if (!contains) return false;
  if (!opts.isExpanded || opts.childPaths.length === 0) return true;

  return !opts.childPaths.some(
    (childPath) =>
      isExactOpenDocument(childPath, open, root) || isOpenDocumentInside(childPath, open, root),
  );
}
