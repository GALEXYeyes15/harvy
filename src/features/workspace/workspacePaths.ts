/** Normalize POSIX-style paths for comparisons. */
export function normalizeFsPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}

/**
 * Workspace-relative path using `/` separators (for storing image `src` in Markdown).
 * Returns null when `absPath` is outside the workspace root.
 */
export function toWorkspaceRelativePath(workspaceRoot: string, absPath: string): string | null {
  const R = normalizeFsPath(workspaceRoot);
  const P = normalizeFsPath(absPath);
  if (P === R) return "";
  const prefix = `${R}/`;
  if (!P.startsWith(prefix)) return null;
  return P.slice(prefix.length);
}

/** True when `targetPath` is the workspace root or a path inside it. */
export function isPathUnderWorkspaceRoot(workspaceRoot: string, targetPath: string): boolean {
  const R = normalizeFsPath(workspaceRoot);
  const P = normalizeFsPath(targetPath);
  const prefix = `${R}/`;
  return P === R || P.startsWith(prefix);
}

/**
 * If `path` is outside the workspace root (e.g. `/Users` or another user), return the root path.
 * Otherwise return `path` unchanged. `null` stays `null`.
 */
export function clampPathToWorkspaceRoot(workspaceRoot: string, path: string | null): string | null {
  if (path == null) return null;
  if (isPathUnderWorkspaceRoot(workspaceRoot, path)) return path;
  return normalizeFsPath(workspaceRoot);
}
