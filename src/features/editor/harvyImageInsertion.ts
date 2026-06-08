import type { Editor } from "@tiptap/core";
import { isNodeEmpty } from "@tiptap/core";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";

function isOutlinePlaceholderBlock(node: PMNode): boolean {
  return node.type.name === "harvyOutlineParagraph" && node.attrs.kind === "placeholder";
}

/** Fresh top-level paragraph with no outline/caption scaffold attrs. */
function createBodyParagraph(schema: Schema): PMNode | null {
  const paragraph = schema.nodes.paragraph;
  if (!paragraph) return null;
  return paragraph.create({ harvyRestorableScaffold: null });
}

/** Clear marks that would carry caption/link styling into new body typing. */
function selectBodyParagraphCursor(tr: Transaction, pos: number, bias: -1 | 1): Transaction {
  const safe = Math.min(Math.max(1, pos), Math.max(1, tr.doc.content.size - 1));
  const $pos = tr.doc.resolve(safe);
  return tr.setSelection(TextSelection.near($pos, bias)).setStoredMarks([]);
}

/**
 * Ensure an adjacent empty block is a normal paragraph (not outline placeholder / restorable scaffold).
 * Returns updated transaction and the block's start position.
 */
function normalizeAdjacentBlockForBodyTyping(
  tr: Transaction,
  schema: Schema,
  blockPos: number,
  block: PMNode,
): { tr: Transaction; blockPos: number } {
  const paragraph = schema.nodes.paragraph;
  if (!paragraph || !block.isTextblock || !isNodeEmpty(block)) {
    return { tr, blockPos };
  }

  if (isOutlinePlaceholderBlock(block)) {
    tr = tr.replaceWith(blockPos, blockPos + block.nodeSize, createBodyParagraph(schema)!);
    return { tr, blockPos };
  }

  if (block.type.name === "paragraph" && block.attrs.harvyRestorableScaffold) {
    tr = tr.setNodeMarkup(blockPos, undefined, {
      ...block.attrs,
      harvyRestorableScaffold: null,
    });
  }

  return { tr, blockPos };
}

/** Ensure a text block exists before the image and place the caret inside it. */
export function focusParagraphBeforeHarvyImageInTr(
  tr: Transaction,
  imagePos: number,
  schema: Schema,
): Transaction {
  const node = tr.doc.nodeAt(imagePos);
  if (!node || node.type.name !== "harvyImage") return tr;

  const paragraph = schema.nodes.paragraph;
  if (!paragraph) return tr;

  const $before = tr.doc.resolve(imagePos);
  const prev = $before.nodeBefore;

  if (prev?.isTextblock) {
    let prevStart = imagePos - prev.nodeSize;
    ({ tr, blockPos: prevStart } = normalizeAdjacentBlockForBodyTyping(tr, schema, prevStart, prev));
    const mappedImagePos = tr.mapping.map(imagePos);
    const cursorPos = Math.max(1, mappedImagePos - 1);
    return selectBodyParagraphCursor(tr, cursorPos, -1);
  }

  const bodyParagraph = createBodyParagraph(schema);
  if (!bodyParagraph) return tr;

  tr = tr.insert(imagePos, bodyParagraph);
  const mappedImagePos = tr.mapping.map(imagePos);
  return selectBodyParagraphCursor(tr, mappedImagePos + 1, 1);
}

/** Ensure a text block exists after the image and place the caret inside it. */
export function focusParagraphAfterHarvyImageInTr(
  tr: Transaction,
  imagePos: number,
  schema: Schema,
): Transaction {
  const node = tr.doc.nodeAt(imagePos);
  if (!node || node.type.name !== "harvyImage") return tr;

  const paragraph = schema.nodes.paragraph;
  if (!paragraph) return tr;

  const after = imagePos + node.nodeSize;
  let next = tr.doc.nodeAt(after);

  if (next?.isTextblock) {
    let nextStart = after;
    ({ tr, blockPos: nextStart } = normalizeAdjacentBlockForBodyTyping(tr, schema, nextStart, next));
    return selectBodyParagraphCursor(tr, nextStart + 1, 1);
  }

  const bodyParagraph = createBodyParagraph(schema);
  if (!bodyParagraph) return tr;

  const mappedAfter = tr.mapping.map(after);
  tr = tr.insert(mappedAfter, bodyParagraph);
  const mappedInsert = tr.mapping.map(mappedAfter);
  return selectBodyParagraphCursor(tr, mappedInsert + 1, 1);
}

export function findHarvyImagePosNearSelection(editor: Editor): number | null {
  const { selection, doc } = editor.state;
  if (selection instanceof NodeSelection && selection.node.type.name === "harvyImage") {
    return selection.from;
  }

  let found: number | null = null;
  const from = Math.max(0, selection.from - 2);
  const to = Math.min(doc.content.size, selection.to + 2);
  doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === "harvyImage") found = pos;
  });
  return found;
}

export function focusParagraphAfterHarvyImageAtPos(editor: Editor, imagePos: number): boolean {
  const { state, view } = editor;
  const tr = focusParagraphAfterHarvyImageInTr(state.tr, imagePos, state.schema);
  view.dispatch(tr);
  view.focus();
  return true;
}

export function focusParagraphBeforeHarvyImageAtPos(editor: Editor, imagePos: number): boolean {
  const { state, view } = editor;
  const tr = focusParagraphBeforeHarvyImageInTr(state.tr, imagePos, state.schema);
  view.dispatch(tr);
  view.focus();
  return true;
}

/** Insert a harvyImage block at the selection without replacing surrounding text. */
export function insertHarvyImageBlocksAtSelection(
  editor: Editor,
  imageAttrs: Record<string, unknown>,
): boolean {
  const didInsert = editor
    .chain()
    .focus()
    .insertContent({ type: "harvyImage", attrs: imageAttrs })
    .run();

  if (!didInsert) return false;

  const imagePos = findHarvyImagePosNearSelection(editor);
  if (imagePos == null) {
    editor.view.focus();
    return true;
  }

  return focusParagraphAfterHarvyImageAtPos(editor, imagePos);
}
