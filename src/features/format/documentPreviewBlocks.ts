import { toEditorHtml } from "../editor/documentMarkdown";

export type DocumentPreviewHeading = {
  kind: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
};

export type DocumentPreviewParagraph = {
  kind: "paragraph";
  lines: string[];
  indent?: number;
};

export type DocumentPreviewListItem = {
  kind: "list-item";
  ordered: boolean;
  depth: number;
  marker: string;
  text: string;
};

export type DocumentPreviewBlock =
  | DocumentPreviewHeading
  | DocumentPreviewParagraph
  | DocumentPreviewListItem;

function normalizeInlineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function shouldSkipElement(el: Element): boolean {
  if (el.hasAttribute("data-harvy-outline-kind")) return true;
  if (el.tagName === "FIGURE" && el.hasAttribute("data-harvy-image")) return true;
  return false;
}

function paragraphLines(el: Element): string[] {
  const lines: string[] = [];
  let buffer = "";

  const flush = () => {
    const text = normalizeInlineText(buffer);
    if (text) lines.push(text);
    buffer = "";
  };

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      buffer += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (element.tagName === "BR") {
      flush();
      return;
    }
    for (const child of element.childNodes) walk(child);
  };

  for (const child of el.childNodes) walk(child);
  flush();
  return lines;
}

function listItemText(li: Element): string {
  const clone = li.cloneNode(true) as Element;
  clone.querySelectorAll("ul, ol").forEach((node) => node.remove());
  return normalizeInlineText(clone.textContent ?? "");
}

function appendList(
  listEl: Element,
  ordered: boolean,
  depth: number,
  blocks: DocumentPreviewBlock[],
) {
  let index = 1;
  for (const child of listEl.children) {
    if (child.tagName !== "LI") continue;
    const text = listItemText(child);
    if (text) {
      blocks.push({
        kind: "list-item",
        ordered,
        depth,
        marker: ordered ? `${index}.` : "•",
        text,
      });
    }
    if (ordered) index += 1;
    for (const nested of child.children) {
      if (nested.tagName === "UL") appendList(nested, false, depth + 1, blocks);
      if (nested.tagName === "OL") appendList(nested, true, depth + 1, blocks);
    }
  }
}

function walkBlockChildren(parent: Element, blocks: DocumentPreviewBlock[], indent = 0) {
  for (const el of parent.children) {
    if (shouldSkipElement(el)) continue;

    const tag = el.tagName;
    if (/^H[1-6]$/.test(tag)) {
      const text = normalizeInlineText(el.textContent ?? "");
      if (text) {
        blocks.push({
          kind: "heading",
          level: Number(tag[1]) as DocumentPreviewHeading["level"],
          text,
        });
      }
      continue;
    }

    if (tag === "P") {
      const lines = paragraphLines(el);
      if (lines.length > 0) {
        blocks.push({
          kind: "paragraph",
          lines,
          ...(indent > 0 ? { indent } : {}),
        });
      }
      continue;
    }

    if (tag === "UL") {
      appendList(el, false, indent, blocks);
      continue;
    }

    if (tag === "OL") {
      appendList(el, true, indent, blocks);
      continue;
    }

    if (tag === "BLOCKQUOTE") {
      walkBlockChildren(el, blocks, indent + 1);
      continue;
    }

    if (tag === "DIV" || tag === "ARTICLE" || tag === "SECTION") {
      walkBlockChildren(el, blocks, indent);
    }
  }
}

function documentPreviewBlocksFromHtml(html: string): DocumentPreviewBlock[] {
  if (!html.trim() || html.trim() === "<p></p>") return [];

  if (typeof document === "undefined") {
    return documentPreviewBlocksFromHtmlSSR(html);
  }

  const root = document.createElement("div");
  root.innerHTML = html;
  const blocks: DocumentPreviewBlock[] = [];
  walkBlockChildren(root, blocks);
  return blocks;
}

/** Best-effort block parse without DOM (non-browser contexts). */
function documentPreviewBlocksFromHtmlSSR(html: string): DocumentPreviewBlock[] {
  const stripped = html
    .replace(/<figure\b[^>]*data-harvy-image[^>]*>[\s\S]*?<\/figure>/gi, "")
    .replace(/<p\b[^>]*data-harvy-outline-kind[^>]*>[\s\S]*?<\/p>/gi, "");

  const blocks: DocumentPreviewBlock[] = [];
  const re =
    /<(h[1-6]|p|ul|ol)\b([^>]*)>([\s\S]*?)<\/\1>|<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stripped)) !== null) {
    const tag = (match[1] ?? "li").toLowerCase();
    if (tag.startsWith("h")) {
      const inner = match[3]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (inner) {
        blocks.push({
          kind: "heading",
          level: Number(tag[1]) as DocumentPreviewHeading["level"],
          text: inner,
        });
      }
    } else if (tag === "p") {
      const inner = match[3]!
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (inner.length > 0) blocks.push({ kind: "paragraph", lines: inner });
    } else if (tag === "li") {
      const inner = (match[4] ?? "")
        .replace(/<ul[\s\S]*$/i, "")
        .replace(/<ol[\s\S]*$/i, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (inner) {
        blocks.push({
          kind: "list-item",
          ordered: false,
          depth: 0,
          marker: "•",
          text: inner,
        });
      }
    }
  }
  return blocks;
}

export function documentPreviewBlocksFromStored(
  stored: string,
  opts?: { sourcePath?: string | null },
): DocumentPreviewBlock[] {
  const raw = stored ?? "";
  if (!raw.trim()) return [];
  const html = toEditorHtml(raw, { sourcePath: opts?.sourcePath ?? null });
  return documentPreviewBlocksFromHtml(html);
}
