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

export function markdownToEditorHtml(markdown: string): string {
  const md = markdown ?? "";
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
  if (/\.(md|markdown|mkd)$/i.test(sourcePath)) return normalized;
  if (looksLikeEditorHtml(normalized)) return editorHtmlToMarkdown(normalized);
  return plainTextToMarkdown(normalized);
}
