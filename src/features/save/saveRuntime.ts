import type { Editor } from "@tiptap/core";
import { editorHtmlToMarkdown } from "../editor/documentMarkdown";
import {
  joinPath,
  splitFileBaseAndExtension,
  validateFolderName,
} from "../workspace/folderNaming";

export type SaveAsOrganizeMode = "file" | "folder";

export type ResolvedSaveAsOutputPath = {
  path: string;
  leaf: string;
  folderBase: string;
};

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function fileNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path || "Untitled";
}

/** Display title base derived from the Save As filename field (normalizes `.md`, hides extension). */
export function documentTitleBaseFromSaveAsFileName(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) return "Untitled";
  const normalized = normalizeMarkdownSavePath(trimmed);
  const { base } = splitFileBaseAndExtension(fileNameFromPath(normalized));
  return base || "Untitled";
}

/** Suggested default filename for Save As (Markdown on disk). */
export function defaultSaveFileName(documentTitle: string): string {
  const trimmed = documentTitle.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Untitled";
  const base = trimmed.replace(/\.[^.\\/]+$/, "");
  return `${base || "Untitled"}.md`;
}

export function defaultPdfFileName(documentTitle: string): string {
  const trimmed = documentTitle.replace(/[/\\?%*:|"<>]/g, "-").trim() || "Untitled";
  const base = trimmed.replace(/\.[^.\\/]+$/, "");
  return `${base || "Untitled"}.pdf`;
}

/** Force `.md` for Save / Save As targets (replaces any other extension). */
export function normalizeMarkdownSavePath(path: string): string {
  const sep = path.includes("\\") ? "\\" : "/";
  const parts = path.split(/[/\\]/);
  const file = parts.pop() ?? path;
  const dir = parts.length ? parts.join(sep) + sep : "";
  const dot = file.lastIndexOf(".");
  const base = dot > 0 ? file.slice(0, dot) : file;
  return `${dir}${base}.md`;
}

/**
 * Resolve the on-disk path for a Save As operation.
 * `file` → `{destination}/{name}.md`
 * `folder` → `{destination}/{basename}/{name}.md`
 */
export function resolveSaveAsOutputPath(
  destinationPath: string,
  fileName: string,
  organize: SaveAsOrganizeMode,
): ResolvedSaveAsOutputPath | null {
  const trimmed = fileName.trim();
  if (!trimmed || !destinationPath.trim()) return null;

  const normalizedFull = normalizeMarkdownSavePath(joinPath(destinationPath, trimmed));
  const leaf = fileNameFromPath(normalizedFull);
  const { base } = splitFileBaseAndExtension(leaf);
  if (!base || validateFolderName(base)) return null;

  if (organize === "file") {
    return { path: normalizedFull, leaf, folderBase: base };
  }

  return {
    path: normalizeMarkdownSavePath(joinPath(joinPath(destinationPath, base), leaf)),
    leaf,
    folderBase: base,
  };
}

/** Validation error for Save As, or null when the path is valid. */
export function validateSaveAsOutputPath(
  destinationPath: string | null,
  fileName: string,
): string | null {
  if (!destinationPath) return "Choose a destination folder.";
  const trimmed = fileName.trim();
  if (!trimmed) return "Enter a file name.";

  const normalizedFull = normalizeMarkdownSavePath(joinPath(destinationPath, trimmed));
  const leaf = fileNameFromPath(normalizedFull);
  const { base } = splitFileBaseAndExtension(leaf);
  return validateFolderName(base);
}

/** Force `.pdf` for export targets. */
export function normalizePdfSavePath(path: string): string {
  const sep = path.includes("\\") ? "\\" : "/";
  const parts = path.split(/[/\\]/);
  const file = parts.pop() ?? path;
  const dir = parts.length ? parts.join(sep) + sep : "";
  const dot = file.lastIndexOf(".");
  const base = dot > 0 ? file.slice(0, dot) : file;
  return `${dir}${base}.pdf`;
}

/**
 * Latest Markdown from the editor (TipTap → Turndown).
 * TODO(product): offer a “clean export” variant that strips `data-harvy-outline-kind` instructions (and optionally placeholders) for published Markdown while keeping the current pipeline for in-app round-trip.
 */
export function getDocumentMarkdown(editor: Editor | null, fallbackMarkdown: string): string {
  try {
    if (editor) return editorHtmlToMarkdown(editor.getHTML());
    return fallbackMarkdown ?? "";
  } catch {
    return fallbackMarkdown ?? "";
  }
}
