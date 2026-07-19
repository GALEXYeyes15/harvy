import MarkdownIt from "markdown-it";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import {
  htmlToPlainTextForStats,
  looksLikeEditorHtml,
  plainTextToHtml,
} from "./documentHtml";

const markdownIt = new MarkdownIt({
  /** Required to round-trip Harvy outline scaffold paragraphs (`data-harvy-outline-kind`) saved in Markdown. */
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
});

/**
 * Empty TipTap paragraphs serialize as `<p></p>` (sometimes `<p><br></p>`).
 * Turndown's default blankReplacement collapses those to `\n\n`, and CommonMark
 * cannot recreate empty paragraphs from extra blank lines alone — so intentional
 * blank lines vanished on save/reopen. Emit HTML islands instead (same approach
 * as outline / image blocks).
 */
function isEmptyParagraphElement(node: {
  nodeName: string;
  textContent?: string | null;
  querySelector?: (selectors: string) => Element | null;
}): boolean {
  if (node.nodeName !== "P") return false;
  const text = (node.textContent || "").replace(/\u00a0/g, " ").trim();
  if (text) return false;
  if (node.querySelector?.("img, figure, video, iframe, object, embed, table")) return false;
  return true;
}

function emptyParagraphMarkdownIsland(node: HTMLElement): string {
  if (node.attributes.length > 0) {
    return `\n\n${node.outerHTML}\n\n`;
  }
  return "\n\n<p></p>\n\n";
}

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  blankReplacement(_content, node) {
    if (isEmptyParagraphElement(node)) {
      return emptyParagraphMarkdownIsland(node as HTMLElement);
    }
    const block = node as HTMLElement & { isBlock?: boolean };
    return block.isBlock ? "\n\n" : "";
  },
});
turndown.use(gfm);

/**
 * Preserve outline scaffold blocks as inline HTML in Markdown so reopening the file keeps semantics.
 * TODO(product): add `editorHtmlToMarkdownCleanExport` for Save/Share that omits instructions (and optionally placeholders) per export rules.
 */
turndown.addRule("harvyOutlineParagraph", {
  filter(node) {
    return (
      node.nodeName === "P" && Boolean((node as HTMLElement).getAttribute?.("data-harvy-outline-kind"))
    );
  },
  replacement(_content, node) {
    const el = node as HTMLElement;
    return `\n\n${el.outerHTML}\n\n`;
  },
});

/** Preserve Harvy image blocks as inline HTML in Markdown (src + caption + width). */
turndown.addRule("harvyImageBlock", {
  filter(node) {
    return node.nodeName === "FIGURE" && Boolean((node as HTMLElement).getAttribute?.("data-harvy-image"));
  },
  replacement(_content, node) {
    const el = node as HTMLElement;
    return `\n\n${el.outerHTML}\n\n`;
  },
});

/**
 * Never let standalone `<img>` fall through to GFM `![]()` — paths with spaces
 * then fail to reopen. Keep them as Harvy figure islands.
 */
turndown.addRule("harvyPlainImgToFigure", {
  filter(node) {
    if (node.nodeName !== "IMG") return false;
    const el = node as HTMLElement;
    if (el.closest?.("figure[data-harvy-image], figure.harvy-image-block")) return false;
    return Boolean(el.getAttribute?.("src")?.trim());
  },
  replacement(_content, node) {
    const el = node as HTMLElement;
    const src = el.getAttribute("src")?.trim() ?? "";
    const alt = el.getAttribute("alt") ?? "";
    const photoBy = /^Photo by (.+) on Unsplash$/i.exec(alt.trim());
    const attrs = [
      'data-harvy-image=""',
      'data-harvy-image-status="loaded"',
      'class="harvy-image-block"',
      'data-width="full"',
    ];
    if (photoBy?.[1]) {
      attrs.push('data-image-source="unsplash"');
      attrs.push(`data-photographer-name="${escapeAttr(photoBy[1].trim())}"`);
      attrs.push('data-unsplash-url="https://unsplash.com"');
      attrs.push(`data-caption="${escapeAttr(alt.trim())}"`);
    } else if (alt.trim()) {
      attrs.push(`data-caption="${escapeAttr(alt.trim())}"`);
    }
    return `\n\n<figure ${attrs.join(" ")}><img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" draggable="false"></figure>\n\n`;
  },
});

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

turndown.addRule("harvyRestorableParagraph", {
  filter(node) {
    return (
      node.nodeName === "P" &&
      Boolean((node as HTMLElement).getAttribute?.("data-harvy-restorable-scaffold")) &&
      !(node as HTMLElement).getAttribute?.("data-harvy-outline-kind")
    );
  },
  replacement(_content, node) {
    const el = node as HTMLElement;
    return `\n\n${el.outerHTML}\n\n`;
  },
});

/**
 * `<p><br></p>` is not Turndown-`isBlank`, so it would become a hard-break and
 * still collapse on reload — catch those here.
 */
turndown.addRule("harvyEmptyParagraph", {
  filter(node) {
    return isEmptyParagraphElement(node);
  },
  replacement(_content, node) {
    return emptyParagraphMarkdownIsland(node as HTMLElement);
  },
});

export function editorHtmlToMarkdown(html: string): string {
  const raw = (html ?? "").trim();
  if (!raw || raw === "<p></p>") return "";
  const out = turndown.turndown(raw).replace(/[ \t]+$/gm, "").replace(/\n+$/, "");
  return out ? `${out}\n` : "";
}

function escapeHtmlText(value: string): string {
  return escapeText(value);
}

function escapeHtmlAttr(value: string): string {
  return escapeAttr(value);
}

/**
 * Some saves left literal/escaped image syntax on disk, e.g.
 * `!\[Photo by …\](Designing habits/Images/img\_1.png)`.
 * Normalize those back to real `![]()` before further conversion.
 */
export function unescapeEscapedMarkdownImages(markdown: string): string {
  const unescapeMd = (value: string) => value.replace(/\\([\\`*_{}\[\]()#+\-.!])/g, "$1");
  return markdown.replace(/!\\\[([\s\S]*?)\\\]\(([^)\n]+)\)/g, (_full, altRaw: string, destRaw: string) => {
    return `![${unescapeMd(altRaw)}](${unescapeMd(destRaw)})`;
  });
}

/**
 * Convert CommonMark images to Harvy figure islands before markdown-it runs.
 * Destinations with spaces (e.g. `Designing habits/Images/x.png`) are invalid
 * unbracketed CommonMark destinations and otherwise render as broken/raw text.
 */
export function markdownStandardImagesToHarvyFigures(markdown: string): string {
  const normalized = unescapeEscapedMarkdownImages(markdown);
  return normalized.replace(/!\[([^\]]*)\]\((<[^>\n]+>|[^)\n]+)\)/g, (_full, altRaw, destRaw) => {
    const alt = String(altRaw ?? "");
    let dest = String(destRaw ?? "").trim();
    if (dest.startsWith("<") && dest.endsWith(">")) {
      dest = dest.slice(1, -1).trim();
    }
    // Drop optional link title: url "title" / url 'title'
    const titled = dest.match(/^(.+?)\s+(["'])([\s\S]*)\2\s*$/);
    const src = (titled?.[1] ?? dest).trim();
    if (!src) return _full;

    const photoBy = /^Photo by (.+) on Unsplash$/i.exec(alt.trim());
    const attrs = [
      'data-harvy-image=""',
      'data-harvy-image-status="loaded"',
      'class="harvy-image-block"',
      'data-width="full"',
    ];
    if (photoBy?.[1]) {
      attrs.push('data-image-source="unsplash"');
      attrs.push(`data-photographer-name="${escapeHtmlAttr(photoBy[1].trim())}"`);
      attrs.push('data-unsplash-url="https://unsplash.com"');
      attrs.push(`data-caption="${escapeHtmlAttr(alt.trim())}"`);
    } else if (alt.trim()) {
      attrs.push(`data-caption="${escapeHtmlAttr(alt.trim())}"`);
    }

    const captionHtml = photoBy?.[1]
      ? "" // Node view rebuilds Unsplash caption from metadata
      : alt.trim()
        ? `<figcaption>${escapeHtmlText(alt.trim())}</figcaption>`
        : "";

    return `\n\n<figure ${attrs.join(" ")}><img src="${escapeHtmlAttr(src)}" alt="${escapeHtmlAttr(alt)}" draggable="false">${captionHtml}</figure>\n\n`;
  });
}

export function markdownToEditorHtml(markdown: string): string {
  const md = markdownStandardImagesToHarvyFigures(markdown ?? "");
  if (!md.trim()) return "<p></p>";
  return markdownIt.render(md);
}

/**
 * Stored document → TipTap HTML. Prefer Markdown on disk; legacy HTML and plain text supported.
 */
export function toEditorHtml(raw: string, opts?: { sourcePath?: string | null }): string {
  const t = raw ?? "";
  if (!t.trim()) return "<p></p>";
  const path = opts?.sourcePath ?? "";
  if (/\.(md|markdown|mkd)$/i.test(path)) return markdownToEditorHtml(t);
  if (/\.(html?|htm)$/i.test(path)) {
    return looksLikeEditorHtml(t) ? t : markdownToEditorHtml(t);
  }
  if (/\.txt$/i.test(path)) return plainTextToHtml(t);
  // In-memory buffers are Markdown (may include `<p></p>` islands). Only treat as
  // raw HTML when the string is TipTap-style markup with no Markdown text blocks.
  if (looksLikeEditorHtml(t)) return t;
  return markdownToEditorHtml(t);
}

/** Plain text for stats when the editor buffer is Markdown (or legacy HTML). */
export function documentTextForStats(stored: string): string {
  if (!stored || !stored.trim()) return "";
  if (looksLikeEditorHtml(stored)) return htmlToPlainTextForStats(stored);
  return htmlToPlainTextForStats(markdownToEditorHtml(stored));
}

export type ComplexitySourceBlock = { text: string; kind: "paragraph" | "heading" };

/** Best-effort HTML parse without DOM (e.g. non-browser contexts). */
function complexitySourceBlocksFromHtmlStringSSR(html: string): ComplexitySourceBlock[] {
  const stripped = html
    .replace(/<figure\b[^>]*data-harvy-image[^>]*>[\s\S]*?<\/figure>/gi, "")
    .replace(/<li\b[^>]*>[\s\S]*?<\/li>/gi, "");
  const blocks: ComplexitySourceBlock[] = [];
  const re = /<(h[1-3]|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const attrs = m[2] ?? "";
    if (/data-harvy-outline-kind/i.test(attrs)) continue;
    const tag = m[1]!.toLowerCase();
    const inner = m[3]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!inner) continue;
    blocks.push({ text: inner, kind: tag.startsWith("h") ? "heading" : "paragraph" });
  }
  return blocks;
}

/**
 * Blocks to analyze for sentence complexity when the ProseMirror doc is unavailable.
 * Omits list items (`li`) so sidebar counts match the editor’s list skipping.
 */
export function complexitySourceBlocksFromStored(
  stored: string,
  opts?: { sourcePath?: string | null },
): ComplexitySourceBlock[] {
  const t = stored ?? "";
  if (!t.trim()) return [];
  const html = toEditorHtml(t, { sourcePath: opts?.sourcePath ?? null });

  if (typeof document === "undefined") {
    return complexitySourceBlocksFromHtmlStringSSR(html);
  }

  const d = document.createElement("div");
  d.innerHTML = html;
  const out: ComplexitySourceBlock[] = [];
  d.querySelectorAll("h1, h2, h3, p").forEach((el) => {
    if (el.closest("li")) return;
    if (el.hasAttribute("data-harvy-outline-kind")) return;
    const text = (el.textContent || "").trim();
    if (!text) return;
    const kind: "heading" | "paragraph" = /^H[1-3]$/i.test(el.tagName) ? "heading" : "paragraph";
    out.push({ text, kind });
  });
  return out;
}

/**
 * Split plain text on paragraph boundaries (`\n\n`) without collapsing consecutive
 * separators, so blank lines become empty paragraphs.
 */
export function splitPlainTextParagraphParts(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n\n");
}

function plainTextToMarkdown(text: string): string {
  const parts = splitPlainTextParagraphParts(text);
  if (parts.length === 0) return "";
  const blocks: string[] = [];
  for (const part of parts) {
    let rest = part;
    while (rest.startsWith("\n")) {
      blocks.push("<p></p>");
      rest = rest.slice(1);
    }
    if (rest === "") {
      blocks.push("<p></p>");
      continue;
    }
    blocks.push(rest.split("\n").join("  \n"));
  }
  const joined = blocks.join("\n\n");
  return joined ? `${joined}\n` : "";
}

/** Normalize file bytes to the Markdown string we keep in workspace state. */
export function ingestTextFileContent(raw: string, sourcePath: string): string {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (/\.(md|markdown|mkd)$/i.test(sourcePath)) {
    // Lift `![]()` (including spaced paths) into figure islands so open/save round-trips.
    return markdownStandardImagesToHarvyFigures(normalized);
  }
  if (looksLikeEditorHtml(normalized)) return editorHtmlToMarkdown(normalized);
  return plainTextToMarkdown(normalized);
}
