import type { FileNode } from "./types";
import { findNodeByPath } from "./tree";

const INVALID_CHARS_RE = /[<>:"/\\|?*\u0000-\u001f]/;

/** Windows reserved device names (with or without extension). */
const WIN_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Parent directory path for a file or folder (best-effort for Windows + POSIX). */
export function parentDirectory(path: string): string {
  const stripped = path.replace(/[/\\]+$/, "");
  if (!stripped) return path;
  const lastSlash = stripped.lastIndexOf("/");
  const lastBack = stripped.lastIndexOf("\\");
  const lastSep = Math.max(lastSlash, lastBack);
  if (lastSep < 0) return stripped;
  if (lastSep === 0) return stripped.slice(0, 1);
  const base = stripped.slice(0, lastSep);
  if (/^[A-Za-z]:$/.test(base)) {
    return `${base}\\`;
  }
  return base;
}

/** Join parent directory and a single path segment (file or folder name). */
export function joinPath(parent: string, childName: string): string {
  const sep = parent.includes("\\") ? "\\" : "/";
  const base = parent.replace(/[/\\]+$/, "");
  return `${base}${sep}${childName}`;
}

/** Split a filename into basename and extension (including the dot), e.g. `Notes.md` → `Notes` + `.md`. */
export function splitFileBaseAndExtension(fileName: string): { base: string; extWithDot: string } {
  const n = fileName.trim();
  if (!n) return { base: "", extWithDot: "" };
  const i = n.lastIndexOf(".");
  if (i <= 0) return { base: n, extWithDot: "" };
  return { base: n.slice(0, i), extWithDot: n.slice(i) };
}

/** Sanitize a single path segment (file basename without extension). May return "". */
export function sanitizeFileBasename(name: string): string {
  const t = name.trim();
  if (!t) return "";
  return t.replace(INVALID_CHARS_RE, "-").replace(/[. \u00a0]+$/g, "").trim();
}

export function validateFolderName(name: string): string | null {
  const t = name.trim();
  if (!t) return "Folder name cannot be empty.";
  if (t === "." || t === "..") return "Invalid folder name.";
  if (INVALID_CHARS_RE.test(t)) return "This name contains characters that are not allowed on this system.";
  if (/[. \u00a0]$/.test(t)) return "Name cannot end with a space or dot.";
  if (WIN_RESERVED_RE.test(t)) return "This name is reserved on Windows.";
  return null;
}

/**
 * Parent path for a new folder: selected directory, else parent of selected file,
 * else current browse folder, else workspace root.
 */
export function resolveParentForNewFolder(
  root: FileNode,
  selectedPath: string | null,
  workspaceBrowsePath: string | null,
): string {
  if (selectedPath) {
    const n = findNodeByPath(root, selectedPath);
    if (n?.kind === "directory") return n.path;
    return parentDirectory(selectedPath);
  }
  if (workspaceBrowsePath) return workspaceBrowsePath;
  return root.path;
}
