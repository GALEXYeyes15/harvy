import type { OutlineTemplate } from "./outlineTypes";

/** Plain-text representation for copying outside Harvy (Notes, Substack, etc.). */
export function outlineTemplateToCopyPlainText(template: OutlineTemplate): string {
  const lines: string[] = [];
  for (const block of template.blocks) {
    switch (block.type) {
      case "heading":
        lines.push(block.text);
        break;
      case "placeholder":
        lines.push(`[${block.text}]`);
        break;
      case "instruction":
        lines.push(`NOTE: ${block.text}`);
        break;
      default:
        break;
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
