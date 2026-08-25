import type { ReactNode } from "react";

type JsonNode = {
  type?: string;
  text?: string;
  content?: JsonNode[];
  marks?: Array<{ type?: string }>;
  attrs?: Record<string, unknown>;
};

function renderTextNode(node: JsonNode, key: string): ReactNode {
  let text: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") {
      text = <strong className="font-semibold text-ink">{text}</strong>;
    } else if (mark.type === "italic") {
      text = <em>{text}</em>;
    }
  }
  return <span key={key}>{text}</span>;
}

function renderInline(nodes: JsonNode[] | undefined, keyPrefix: string): ReactNode[] {
  if (!nodes?.length) return [];
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === "text") return renderTextNode(node, key);
    if (node.type === "substack_mention") {
      const label =
        (typeof node.attrs?.label === "string" && node.attrs.label) ||
        (typeof node.attrs?.name === "string" && node.attrs.name) ||
        node.text ||
        "";
      return (
        <span key={key} className="font-medium text-ink/90">
          {label}
        </span>
      );
    }
    if (node.content?.length) {
      return <span key={key}>{renderInline(node.content, key)}</span>;
    }
    return null;
  });
}

function renderBlock(node: JsonNode, key: string): ReactNode {
  switch (node.type) {
    case "paragraph":
      return (
        <p key={key} className="min-h-[1em] break-words [overflow-wrap:anywhere]">
          {node.content?.length ? renderInline(node.content, key) : "\u00A0"}
        </p>
      );
    case "bulletList":
      return (
        <ul key={key} className="list-disc space-y-1 pl-4">
          {(node.content ?? []).map((item, index) => renderBlock(item, `${key}-li-${index}`))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="list-decimal space-y-1 pl-4">
          {(node.content ?? []).map((item, index) => renderBlock(item, `${key}-li-${index}`))}
        </ol>
      );
    case "listItem":
      return (
        <li key={key}>
          {(node.content ?? []).map((child, index) => renderBlock(child, `${key}-c-${index}`))}
        </li>
      );
    default:
      if (node.content?.length) {
        return (
          <div key={key}>
            {node.content.map((child, index) => renderBlock(child, `${key}-${index}`))}
          </div>
        );
      }
      return null;
  }
}

/** Render Substack Note ProseMirror JSON with paragraph breaks and basic marks. */
export function SubstackNoteBody({
  doc,
  className = "min-w-0 break-words space-y-2.5 text-[12px] leading-relaxed text-ink/88 dark:text-white/82 [overflow-wrap:anywhere]",
}: {
  doc: unknown;
  className?: string;
}) {
  if (!doc || typeof doc !== "object") return null;
  const root = doc as JsonNode;
  const blocks = root.type === "doc" ? root.content ?? [] : [root];

  return (
    <div className={className}>
      {blocks.map((block, index) => renderBlock(block, `b-${index}`))}
    </div>
  );
}

export function isSubstackNoteDoc(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as JsonNode).type === "doc");
}

function plainInlineText(nodes: JsonNode[] | undefined): string {
  if (!nodes?.length) return "";
  return nodes
    .map((node) => {
      if (node.type === "text") return node.text ?? "";
      if (node.type === "hardBreak") return "\n";
      if (node.type === "substack_mention") {
        return (
          (typeof node.attrs?.label === "string" && node.attrs.label) ||
          (typeof node.attrs?.name === "string" && node.attrs.name) ||
          node.text ||
          ""
        );
      }
      if (node.content?.length) return plainInlineText(node.content);
      return node.text ?? "";
    })
    .join("");
}

function plainListItemLines(item: JsonNode, marker: string, indent: string): string[] {
  const lines: string[] = [];
  let headed = false;

  for (const child of item.content ?? []) {
    if (child.type === "bulletList" || child.type === "orderedList") {
      lines.push(...plainListLines(child, `${indent}  `));
      continue;
    }
    if (child.type === "paragraph") {
      const text = plainInlineText(child.content).trim();
      if (!text) continue;
      if (!headed) {
        lines.push(`${indent}${marker} ${text}`);
        headed = true;
      } else {
        lines.push(`${indent}  ${text}`);
      }
      continue;
    }
    const nested = plainBlockLines(child, indent);
    if (!nested.length) continue;
    if (!headed) {
      lines.push(`${indent}${marker} ${nested[0]!.trimStart()}`);
      lines.push(...nested.slice(1));
      headed = true;
    } else {
      lines.push(...nested);
    }
  }

  if (!headed) {
    lines.push(`${indent}${marker}`);
  }
  return lines;
}

function plainListLines(node: JsonNode, indent = ""): string[] {
  const items = node.content ?? [];
  if (node.type === "bulletList") {
    return items.flatMap((item) => plainListItemLines(item, "-", indent));
  }
  if (node.type === "orderedList") {
    return items.flatMap((item, index) => plainListItemLines(item, `${index + 1}.`, indent));
  }
  return [];
}

function plainBlockLines(node: JsonNode, indent = ""): string[] {
  switch (node.type) {
    case "paragraph": {
      const text = plainInlineText(node.content).trimEnd();
      return text ? [`${indent}${text}`] : [""];
    }
    case "bulletList":
    case "orderedList":
      return plainListLines(node, indent);
    case "listItem":
      return plainListItemLines(node, "-", indent);
    default:
      if (!node.content?.length) {
        const text = (node.text ?? "").trim();
        return text ? [`${indent}${text}`] : [];
      }
      return node.content.flatMap((child) => plainBlockLines(child, indent));
  }
}

/**
 * Flatten Substack Note JSON to plain text for the Notes sidebar.
 * Bullet / numbered lists become `- item` and `1. item` (no rich indent UI).
 */
export function substackNoteDocToPlainText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const root = doc as JsonNode;
  const blocks = root.type === "doc" ? root.content ?? [] : [root];
  const lines = blocks.flatMap((block) => plainBlockLines(block));

  const out: string[] = [];
  for (const line of lines) {
    if (line === "" && out[out.length - 1] === "") continue;
    out.push(line);
  }
  return out.join("\n").trim();
}
