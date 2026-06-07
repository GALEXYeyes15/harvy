import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Plain-text export for the current document: headings + outline blocks only.
 * Normal paragraphs and other nodes are skipped (MVP).
 */
export function documentToOutlinePlainText(doc: PMNode): string {
  const lines: string[] = [];

  doc.descendants((node) => {
    if (node.type.name === "heading") {
      const t = node.textContent.replace(/\s+/g, " ").trim();
      if (t) lines.push(t);
      lines.push("");
      return false;
    }
    if (node.type.name === "harvyOutlineParagraph") {
      const kind = node.attrs.kind as string;
      const t = node.textContent.replace(/\s+/g, " ").trim();
      if (kind === "placeholder") {
        lines.push(`[${t}]`);
      } else if (kind === "instruction") {
        lines.push(`NOTE: ${t}`);
      }
      lines.push("");
      return false;
    }
    return true;
  });

  return lines.join("\n").trimEnd();
}
