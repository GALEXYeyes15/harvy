import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { Selection } from "@tiptap/pm/state";

/** Block types we can rewrite into outline roles (block-level MVP). */
const CONVERTIBLE_BLOCK_TYPES = new Set(["paragraph", "heading", "harvyOutlineParagraph"]);

export function findConvertibleBlockNearSelection(selection: Selection): {
  pos: number;
  node: PMNode;
} | null {
  const $from = selection.$from;
  for (let d = $from.depth; d >= 1; d--) {
    const node = $from.node(d);
    if (CONVERTIBLE_BLOCK_TYPES.has(node.type.name)) {
      return { pos: $from.before(d), node };
    }
  }
  return null;
}

const DEFAULT_HEADING_LEVEL = 2;

export function convertBlockToHeading(editor: Editor): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const found = findConvertibleBlockNearSelection(state.selection);
      if (!found) return false;
      const { pos, node } = found;
      const end = pos + node.nodeSize;
      const heading = state.schema.nodes.heading;
      if (!heading) return false;
      const level =
        node.type.name === "heading" ? (node.attrs.level as number) : DEFAULT_HEADING_LEVEL;
      const next = heading.create({ level }, node.content);
      tr.replaceWith(pos, end, next);
      dispatch?.(tr);
      return true;
    })
    .run();
}

export function convertBlockToPlaceholder(editor: Editor): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const found = findConvertibleBlockNearSelection(state.selection);
      if (!found) return false;
      const { pos, node } = found;
      const end = pos + node.nodeSize;
      const outline = state.schema.nodes.harvyOutlineParagraph;
      if (!outline) return false;
      const next = outline.create({ kind: "placeholder", writingScaffold: null }, node.content);
      tr.replaceWith(pos, end, next);
      dispatch?.(tr);
      return true;
    })
    .run();
}

export function convertBlockToInstruction(editor: Editor): boolean {
  return editor
    .chain()
    .focus()
    .command(({ state, tr, dispatch }) => {
      const found = findConvertibleBlockNearSelection(state.selection);
      if (!found) return false;
      const { pos, node } = found;
      const end = pos + node.nodeSize;
      const outline = state.schema.nodes.harvyOutlineParagraph;
      if (!outline) return false;
      const next = outline.create({ kind: "instruction", writingScaffold: null }, node.content);
      tr.replaceWith(pos, end, next);
      dispatch?.(tr);
      return true;
    })
    .run();
}
