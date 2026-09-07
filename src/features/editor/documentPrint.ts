import type { Editor } from "@tiptap/core";
import { invoke } from "@tauri-apps/api/core";
import { markdownToEditorHtml } from "./documentMarkdown";
import { getDocumentMarkdown, isTauriRuntime } from "../save/saveRuntime";

export const PRINT_ROOT_ID = "harvy-print-root";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPrintDocumentHtml(title: string, bodyHtml: string): string {
  const safeTitle = escapeHtml(title.trim() || "Document");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function unfinishedImages(root: ParentNode): HTMLImageElement[] {
  return Array.from(root.querySelectorAll("img")).filter((img) => !img.complete);
}

function waitForImages(root: ParentNode): Promise<void> {
  const images = unfinishedImages(root);
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

/**
 * Browser fallback: print from the main window.
 * Tauri macOS ignores this from the native File menu (no webview user gesture).
 */
export function printHtmlDocument(title: string, bodyHtml: string): void {
  document.getElementById(PRINT_ROOT_ID)?.remove();

  const root = document.createElement("div");
  root.id = PRINT_ROOT_ID;
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = bodyHtml;
  document.body.appendChild(root);

  const previousTitle = document.title;
  document.title = title.trim() || "Document";

  let cleaned = false;
  let timeoutId = 0;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.clearTimeout(timeoutId);
    window.removeEventListener("afterprint", cleanup);
    document.title = previousTitle;
    root.remove();
  };
  window.addEventListener("afterprint", cleanup);
  timeoutId = window.setTimeout(cleanup, 120_000);

  const printNow = () => {
    if (!root.isConnected) return;
    window.print();
  };

  if (unfinishedImages(root).length === 0) {
    printNow();
    return;
  }

  void waitForImages(root).then(printNow);
}

export async function printMarkdownDocument(title: string, markdown: string): Promise<void> {
  const trimmed = markdown.trim();
  if (!trimmed) {
    window.alert("Nothing to print — the document is empty.");
    return;
  }
  if (isTauriRuntime()) {
    await invoke("print_markdown", {
      markdown,
      title: title.trim() || "Untitled",
    });
    return;
  }
  printHtmlDocument(title, markdownToEditorHtml(markdown));
}

/** Open the native print dialog for the current document. */
export async function printDocumentFromEditor(
  editor: Editor | null,
  fallbackMarkdown: string,
  title: string,
): Promise<void> {
  const markdown = getDocumentMarkdown(editor, fallbackMarkdown);
  await printMarkdownDocument(title, markdown);
}
