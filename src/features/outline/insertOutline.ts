import type { Editor } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import type { OutlineBlock, OutlineTemplate } from "./outlineTypes";

function blockToTipTap(block: OutlineBlock): JSONContent {
  switch (block.type) {
    case "heading":
      return {
        type: "heading",
        attrs: { level: block.level ?? 2 },
        content: block.text ? [{ type: "text", text: block.text }] : [],
      };
    case "placeholder":
      return {
        type: "harvyOutlineParagraph",
        attrs: { kind: "placeholder", writingScaffold: block.text },
        content: block.text ? [{ type: "text", text: block.text }] : [],
      };
    case "instruction":
      return {
        type: "harvyOutlineParagraph",
        attrs: { kind: "instruction", writingScaffold: null },
        content: block.text ? [{ type: "text", text: block.text }] : [],
      };
    default:
      return { type: "paragraph" };
  }
}

export function templateToTipTapContent(template: OutlineTemplate): JSONContent[] {
  return template.blocks.map(blockToTipTap);
}

/** True when the doc is a single empty paragraph (TipTap default empty doc). */
export function isEditorDocumentEmpty(editor: Editor): boolean {
  const { doc } = editor.state;
  if (doc.childCount !== 1) return false;
  const first = doc.firstChild;
  if (!first || first.type.name !== "paragraph") return false;
  return first.content.size === 0;
}

/**
 * Insert outline: replace empty doc, otherwise insert at selection (collapsed cursor) or append at end.
 */
export function insertOutlineTemplate(editor: Editor, template: OutlineTemplate): void {
  const fragments = templateToTipTapContent(template);
  if (fragments.length === 0) return;

  if (isEditorDocumentEmpty(editor)) {
    editor.chain().focus().setContent({ type: "doc", content: fragments }).run();
    return;
  }

  const sel = editor.state.selection;
  if (sel.empty) {
    editor.chain().focus().insertContentAt(sel.from, fragments).run();
  } else {
    editor.chain().focus().insertContentAt({ from: sel.from, to: sel.to }, fragments).run();
  }
}
