import type { Editor } from "@tiptap/core";
import { buildUnsplashAttribution } from "./harvyImageAttribution";
import { resolveWorkspaceImageSrc } from "./imageAssets";
import { editorHtmlToMarkdown, markdownToEditorHtml } from "./documentMarkdown";
import { getDocumentMarkdown } from "../save/saveRuntime";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Resolve image `src` for external paste — embed local/asset images as data URLs when possible. */
async function resolveImageSrcForClipboard(
  storedSrc: string,
  workspaceRoot: string | null,
): Promise<string> {
  const resolved = resolveWorkspaceImageSrc(workspaceRoot, storedSrc);
  if (!resolved) return "";
  if (/^data:/i.test(resolved)) return resolved;
  if (/^https?:/i.test(resolved)) return resolved;

  try {
    const res = await fetch(resolved);
    if (!res.ok) return resolved;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return resolved;
  }
}

function buildCopyCaptionHtml(fig: HTMLElement): string {
  const photographerName = fig.getAttribute("data-photographer-name")?.trim() ?? "";
  if (!photographerName) return "";
  return buildUnsplashAttribution({
    photographerName,
    photographerUrl: fig.getAttribute("data-photographer-url")?.trim() ?? "#",
    unsplashUrl: fig.getAttribute("data-unsplash-url") ?? undefined,
  }).captionHtml;
}

function normalizeUnsplashCaptionHtml(html: string, fig: HTMLElement): string {
  if (html.includes("</a>")) return html;
  return buildCopyCaptionHtml(fig) || html;
}

function readImageCaption(fig: HTMLElement): { plain: string; html: string | null } {
  const figcaption = fig.querySelector("figcaption");
  if (figcaption?.querySelector("a")) {
    return {
      plain: figcaption.textContent?.trim() ?? "",
      html: figcaption.innerHTML.trim(),
    };
  }

  const captionHtml = fig.getAttribute("data-caption-html")?.trim();
  if (captionHtml) {
    const host = document.createElement("div");
    host.innerHTML = captionHtml;
    return {
      plain: host.textContent?.trim() ?? "",
      html: captionHtml,
    };
  }

  const plain =
    figcaption?.textContent?.trim() ||
    fig.getAttribute("data-caption")?.trim() ||
    "";
  return { plain, html: null };
}

function stripCopyAttributes(root: HTMLElement): void {
  root.querySelectorAll("*").forEach((el) => {
    el.removeAttribute("data-harvy-image");
    el.removeAttribute("data-harvy-image-status");
    el.removeAttribute("data-harvy-image-width");
    el.removeAttribute("data-width");
    el.removeAttribute("data-caption");
    el.removeAttribute("data-caption-html");
    el.removeAttribute("data-image-source");
    el.removeAttribute("data-photographer-name");
    el.removeAttribute("data-photographer-url");
    el.removeAttribute("data-unsplash-url");
    el.removeAttribute("data-harvy-outline-kind");
    el.removeAttribute("data-harvy-restorable-scaffold");
    el.removeAttribute("data-placeholder");
    el.removeAttribute("data-drag-handle");
    el.removeAttribute("draggable");
    el.removeAttribute("contenteditable");

    if (!el.hasAttribute("class")) return;
    const kept = el
      .getAttribute("class")!
      .split(/\s+/)
      .filter((token) => token && !token.startsWith("harvy-") && token !== "is-empty");
    if (kept.length) el.setAttribute("class", kept.join(" "));
    else el.removeAttribute("class");
  });
}

function wrapCopyHtmlFragment(bodyInner: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><!--StartFragment-->${bodyInner}<!--EndFragment--></body></html>`;
}

/**
 * Serialize editor HTML into paste-ready rich HTML:
 * paragraphs, headings, blockquotes, dividers, and figure/img + figcaption.
 */
export async function editorHtmlToCopyHtml(
  editorHtml: string,
  workspaceRoot: string | null,
): Promise<string> {
  const raw = (editorHtml ?? "").trim();
  if (!raw || raw === "<p></p>") return "";

  const host = document.createElement("div");
  host.innerHTML = raw;

  const figures = Array.from(host.querySelectorAll<HTMLElement>("figure[data-harvy-image]"));
  for (const fig of figures) {
    const status = fig.getAttribute("data-harvy-image-status");
    const imgEl = fig.querySelector("img");
    const storedSrc = imgEl?.getAttribute("src") ?? "";

    if (status === "placeholder" || !storedSrc) {
      fig.remove();
      continue;
    }

    const alt = imgEl?.getAttribute("alt") ?? "";
    const caption = readImageCaption(fig);
    const resolvedSrc = await resolveImageSrcForClipboard(storedSrc, workspaceRoot);

    const cleanFig = document.createElement("figure");
    const newImg = document.createElement("img");
    newImg.setAttribute("src", resolvedSrc);
    if (alt) newImg.setAttribute("alt", alt);
    cleanFig.appendChild(newImg);
    if (caption.plain) {
      const cap = document.createElement("figcaption");
      if (caption.html) {
        cap.innerHTML = normalizeUnsplashCaptionHtml(caption.html, fig);
      } else if (
        fig.getAttribute("data-image-source") === "unsplash" &&
        fig.getAttribute("data-photographer-name")
      ) {
        cap.innerHTML = buildCopyCaptionHtml(fig);
      } else {
        cap.textContent = caption.plain;
      }
      cleanFig.appendChild(cap);
    }
    fig.replaceWith(cleanFig);
  }

  const looseImgs = Array.from(host.querySelectorAll<HTMLImageElement>("img")).filter(
    (img) => !img.closest("figure"),
  );
  for (const img of looseImgs) {
    const storedSrc = img.getAttribute("src") ?? "";
    if (!storedSrc) {
      img.remove();
      continue;
    }

    const resolvedSrc = await resolveImageSrcForClipboard(storedSrc, workspaceRoot);
    const alt = img.getAttribute("alt") ?? "";
    const fig = document.createElement("figure");
    const newImg = document.createElement("img");
    newImg.setAttribute("src", resolvedSrc);
    if (alt) newImg.setAttribute("alt", alt);
    fig.appendChild(newImg);
    if (alt) {
      const cap = document.createElement("figcaption");
      cap.textContent = alt;
      fig.appendChild(cap);
    }
    img.replaceWith(fig);
  }

  stripCopyAttributes(host);

  const inner = host.innerHTML.trim();
  if (!inner) return "";
  return wrapCopyHtmlFragment(inner);
}

/** Convert embedded figure HTML in Markdown/plain copy output to readable image lines. */
function normalizePlainCopyText(plain: string, workspaceRoot: string | null): string {
  if (!plain.includes("<figure")) return plain;

  return plain.replace(/<figure\b[^>]*data-harvy-image[^>]*>[\s\S]*?<\/figure>/gi, (match) => {
    const host = document.createElement("div");
    host.innerHTML = match;
    const fig = host.querySelector<HTMLElement>("figure[data-harvy-image]");
    if (!fig) return "";

    const status = fig.getAttribute("data-harvy-image-status");
    const img = fig.querySelector("img");
    const storedSrc = img?.getAttribute("src") ?? "";
    if (status === "placeholder" || !storedSrc) return "";

    const alt = img?.getAttribute("alt") ?? "";
    const caption = readImageCaption(fig);
    const resolved = resolveWorkspaceImageSrc(workspaceRoot, storedSrc);
    const lines = [`![${alt}](${resolved})`];
    if (caption.plain && caption.plain !== alt) lines.push(caption.plain);
    return lines.join("\n");
  });
}

export function editorHtmlToCopyPlainText(
  editorHtml: string,
  workspaceRoot: string | null,
): string {
  const markdown = editorHtmlToMarkdown(editorHtml);
  const normalized = normalizePlainCopyText(markdown, workspaceRoot);
  return normalized.trimEnd() ? `${normalized.trimEnd()}\n` : "";
}

export async function getDocumentCopyPayload(
  editor: Editor | null,
  fallbackMarkdown: string,
  workspaceRoot: string | null,
): Promise<{ html: string; plain: string }> {
  const editorHtml = editor ? editor.getHTML() : markdownToEditorHtml(fallbackMarkdown);
  const [html, plain] = await Promise.all([
    editorHtmlToCopyHtml(editorHtml, workspaceRoot),
    Promise.resolve(
      editor
        ? editorHtmlToCopyPlainText(editorHtml, workspaceRoot)
        : normalizePlainCopyText(getDocumentMarkdown(null, fallbackMarkdown), workspaceRoot),
    ),
  ]);
  return { html, plain };
}

/**
 * Write rich HTML + plain text to the clipboard.
 * Falls back to plain text only when ClipboardItem is unavailable.
 */
export async function writeDocumentClipboard(payload: {
  html: string;
  plain: string;
}): Promise<boolean> {
  const plain = payload.plain ?? "";
  const html = payload.html?.trim() ?? "";

  if (typeof navigator === "undefined") return false;

  if (
    html &&
    navigator.clipboard?.write &&
    typeof ClipboardItem !== "undefined"
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        }),
      ]);
      return true;
    } catch {
      // Fall through to text-only copy.
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(plain);
    return true;
  }

  return false;
}

export async function copyDocumentToClipboard(
  editor: Editor | null,
  fallbackMarkdown: string,
  workspaceRoot: string | null,
): Promise<boolean> {
  const payload = await getDocumentCopyPayload(editor, fallbackMarkdown, workspaceRoot);
  if (!payload.plain && !payload.html) return false;
  return writeDocumentClipboard(payload);
}
