/**
 * True when `s` looks like TipTap/editor HTML rather than Markdown.
 * Markdown may embed HTML islands (e.g. empty `<p></p>`) surrounded by blank
 * lines — those must still go through markdown-it, not be treated as a full HTML doc.
 */
export function looksLikeEditorHtml(s: string): boolean {
  const t = s.trim();
  if (!/^<\s*(p|div|h[1-6]|ul|ol|li|blockquote|br|figure)\b/i.test(t)) return false;
  // Markdown-with-islands: blank line then plain text (not a tag).
  if (/\n\n\s*[^<\s]/.test(t)) return false;
  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Split plain text on `\n\n` without collapsing consecutive separators.
 * Leading `\n` inside a part become preceding empty paragraphs.
 */
function plainTextParagraphHtmlParts(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = normalized.split("\n\n");
  const htmlParts: string[] = [];

  for (const part of parts) {
    let rest = part;
    while (rest.startsWith("\n")) {
      htmlParts.push("<p></p>");
      rest = rest.slice(1);
    }
    if (rest === "") {
      htmlParts.push("<p></p>");
      continue;
    }
    const trimmed = rest.trimEnd();
    if (!trimmed.trim()) {
      htmlParts.push("<p></p>");
      continue;
    }
    const inner = escapeHtml(trimmed).replace(/\n/g, "<br>");
    htmlParts.push(`<p>${inner}</p>`);
  }

  return htmlParts;
}

export function plainTextToHtml(text: string): string {
  const htmlParts = plainTextParagraphHtmlParts(text);
  return htmlParts.length > 0 ? htmlParts.join("") : "<p></p>";
}

/** Plain text for readability stats (strip tags, normalize whitespace). */
export function htmlToPlainTextForStats(html: string): string {
  if (!html || !html.trim()) return "";
  if (typeof document === "undefined") {
    const stripped = html.replace(
      /<p\b[^>]*data-harvy-outline-kind=["']?(?:instruction|placeholder)["']?[^>]*>[\s\S]*?<\/p>/gi,
      " ",
    );
    return stripped.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const d = document.createElement("div");
  d.innerHTML = html;
  d.querySelectorAll("[data-harvy-outline-kind]").forEach((el) => el.remove());
  return (d.textContent || "").replace(/\s+/g, " ").trim();
}
