import type { Editor } from "@tiptap/core";
import type { Schema } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";

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
    const $pos = tr.doc.resolve(Math.max(0, imagePos - 1));
    return tr.setSelection(TextSelection.near($pos, -1));
  }

  tr = tr.insert(imagePos, paragraph.create());
  return tr.setSelection(TextSelection.near(tr.doc.resolve(imagePos + 1), 1));
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
  const next = tr.doc.nodeAt(after);

  if (!next?.isTextblock) {
    tr = tr.insert(after, paragraph.create());
  }

  const cursorPos = after + 1;
  const $pos = tr.doc.resolve(Math.min(cursorPos, tr.doc.content.size - 1));
  return tr.setSelection(TextSelection.near($pos, 1));
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
