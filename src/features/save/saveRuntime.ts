import type { Editor } from "@tiptap/core";
import { editorHtmlToMarkdown } from "../editor/documentMarkdown";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function fileNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path || "Untitled";
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
