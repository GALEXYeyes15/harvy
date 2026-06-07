import type { Node as PMNode } from "@tiptap/pm/model";
import { Fragment } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";

/**
 * When Create Outline Mode toggles, convert placeholder blocks between:
 * - **Authoring (ON):** inline content holds the definitional scaffold text.
 * - **Writing (OFF):** body is empty; `writingScaffold` holds the hint for TipTap-style placeholders.
 */
export function syncOutlinePlaceholdersForAuthoringMode(
  state: EditorState,
  createOutlineMode: boolean,
): Transaction | null {
  const outline = state.schema.nodes.harvyOutlineParagraph;
  if (!outline) return null;

  const blocks: { pos: number; node: PMNode }[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type === outline && node.attrs.kind === "placeholder") {
      blocks.push({ pos, node });
    }
    return true;
  });

  let tr = state.tr;
  let changed = false;

  for (let i = blocks.length - 1; i >= 0; i--) {
    const { pos, node } = blocks[i]!;
    if (createOutlineMode) {
      if (node.content.size > 0) continue;
      const scaffold = ((node.attrs.writingScaffold as string | null) ?? "").trim();
      if (!scaffold) continue;
      const textNode = state.schema.text(scaffold);
      const next = outline.create(node.attrs, Fragment.from(textNode));
      tr = tr.replaceWith(pos, pos + node.nodeSize, next);
      changed = true;
    } else {
      const text = node.textBetween(0, node.content.size, "", "");
      const prevScaffold = (node.attrs.writingScaffold as string | null) ?? "";
      if (node.content.size === 0 && prevScaffold === text) continue;
      const nextAttrs = { ...node.attrs, writingScaffold: text };
      const next = outline.create(nextAttrs, Fragment.empty);
      tr = tr.replaceWith(pos, pos + node.nodeSize, next);
      changed = true;
    }
  }

  return changed ? tr : null;
}
