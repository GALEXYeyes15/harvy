export function looksLikeEditorHtml(s: string): boolean {
  return /<\s*(p|div|h[1-6]|ul|ol|li|blockquote|br)\b/i.test(s);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function plainTextToHtml(text: string): string {
  const blocks = text.split(/\n\s*\n/);
  return blocks
    .map((block) => {
      const trimmed = block.trimEnd();
      if (!trimmed.trim()) return "<p></p>";
      const inner = escapeHtml(trimmed).replace(/\n/g, "<br>");
      return `<p>${inner}</p>`;
    })
    .join("");
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
