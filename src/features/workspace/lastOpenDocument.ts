import { toWorkspaceRelativePath, normalizeFsPath } from "./workspacePaths";

const STORAGE_KEY = "harvy:last-open-document";

export function readLastOpenDocumentRelative(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY)?.trim() ?? "";
    return raw || null;
  } catch {
    return null;
  }
}

export function writeLastOpenDocumentRelative(relativePath: string | null): void {
  if (typeof localStorage === "undefined") return;
  const trimmed = relativePath?.trim() ?? "";
  try {
    if (!trimmed) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, trimmed);
  } catch {
    // Ignore quota / private-mode failures; restore is best-effort.
  }
}

/** Join a workspace-relative file path onto the current workspace root. */
export function resolveLastOpenDocumentAbsPath(
  workspaceRoot: string,
  relativePath: string,
): string | null {
  const rel = relativePath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!rel || rel === "." || rel.split("/").some((seg) => seg === ".." || seg === "")) {
    return null;
  }
  return `${normalizeFsPath(workspaceRoot)}/${rel}`;
}

/** Persist the open file as a workspace-relative path, or clear when there isn’t one. */
export function rememberLastOpenDocument(
  workspaceRoot: string | null,
  absPath: string | null | undefined,
): void {
  const path = absPath?.trim() ?? "";
  if (!workspaceRoot?.trim() || !path || path.startsWith("harvy:")) {
    writeLastOpenDocumentRelative(null);
    return;
  }
  const relative = toWorkspaceRelativePath(workspaceRoot, path);
  if (!relative) {
    writeLastOpenDocumentRelative(null);
    return;
  }
  writeLastOpenDocumentRelative(relative);
}
