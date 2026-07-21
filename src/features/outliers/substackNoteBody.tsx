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
        <p key={key} className="min-h-[1em]">
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
  className = "space-y-2.5 text-[12px] leading-relaxed text-ink/88 dark:text-white/82",
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
