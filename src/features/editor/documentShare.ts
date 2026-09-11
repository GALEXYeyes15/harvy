import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";

export type ShareAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function shareAnchorFromElement(el: HTMLElement): ShareAnchor {
  const rect = el.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/** Render Markdown to a PDF and open the macOS share sheet (AirDrop, Messages, …). */
export async function shareMarkdownPdf(
  title: string,
  markdown: string,
  fileName: string,
  anchor?: ShareAnchor,
): Promise<void> {
  const trimmed = markdown.trim();
  if (!trimmed) {
    window.alert("Nothing to share — the document is empty.");
    return;
  }
  if (!isTauriRuntime()) {
    window.alert("Share is available in the Harvy desktop app on macOS.");
    return;
  }
  await invoke("share_markdown", {
    markdown,
    title: title.trim() || "Untitled",
    fileName: fileName.trim() || "Podcast Notes.pdf",
    anchor: anchor ?? null,
  });
}
