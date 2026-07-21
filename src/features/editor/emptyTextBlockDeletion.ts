import type { Node as PMNode } from "@tiptap/pm/model";
import type { ResolvedPos } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { isCursorAtStartOfListItemState } from "./harvyListKeyboard";
import { joinParagraphWithPrecedingListOnBackspace } from "./joinParagraphWithPrecedingList";

/** Temporary logging to verify Substack-style Backspace in the active editor. */
function logSubstackBackspace(step: string, detail?: Record<string, unknown>): void {
  console.log("[HarvySubstackBackspace]", step, detail ?? "");
}

type TopLevelBlock = { node: PMNode; pos: number };

function listTopLevelBlocks(doc: PMNode): TopLevelBlock[] {
  const blocks: TopLevelBlock[] = [];
  let offset = 0;
  for (let i = 0; i < doc.childCount; i++) {
    const node = doc.child(i);
    blocks.push({ node, pos: offset });
    offset += node.nodeSize;
  }
  return blocks;
}

/** True when a text block has no meaningful text (whitespace, hard breaks, and filler only). */
export function isTextBlockEffectivelyEmpty(node: PMNode): boolean {
  if (!node.isTextblock) return false;
  if (node.content.size === 0) return true;

  let empty = true;
  node.content.forEach((child) => {
    if (!empty) return;
    if (child.type.name === "hardBreak") return;
    if (child.isText) {
      if ((child.text ?? "").replace(/\s+/g, "").length > 0) empty = false;
      return;
    }
    empty = false;
  });
  return empty;
}

/** Cursor position inside a text block (start or end depending on direction). */
function textBlockCursorPos(node: PMNode, blockPos: number, atEnd: boolean): number {
  return atEnd ? blockPos + node.nodeSize - 1 : blockPos + 1;
}

/** Nearest top-level text block before or after `pos` (skips images and other atoms). */
function findNearestTextBlockPos(doc: PMNode, pos: number, direction: -1 | 1): number | null {
  const blocks = listTopLevelBlocks(doc);

  if (direction === -1) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const { node, pos: blockPos } = blocks[i]!;
      if (blockPos + node.nodeSize <= pos && node.isTextblock) {
        return textBlockCursorPos(node, blockPos, true);
      }
    }
    return null;
  }

  for (const { node, pos: blockPos } of blocks) {
    if (blockPos >= pos && node.isTextblock) {
      return textBlockCursorPos(node, blockPos, false);
    }
  }
  return null;
}

function docHasTextBlock(doc: PMNode): boolean {
  for (let i = 0; i < doc.childCount; i++) {
    if (doc.child(i).isTextblock) return true;
  }
  return false;
}

/** Position of the top-level `horizontalRule` directly before the block containing `$from`, if any. */
function getHorizontalRulePosDirectlyAbove($from: ResolvedPos): number | null {
  if ($from.depth < 1) return null;

  const blockIndex = $from.index(1);
  if (blockIndex <= 0) return null;

  const doc = $from.node(0);
  const previous = doc.child(blockIndex - 1);
  if (previous.type.name !== "horizontalRule") return null;

  let hrPos = 0;
  for (let i = 0; i < blockIndex - 1; i++) {
    hrPos += doc.child(i).nodeSize;
  }

  return hrPos;
}

function getHorizontalRulePosDirectlyBeforeBlockStart(doc: PMNode, blockStart: number): number | null {
  if (blockStart <= 0) return null;
  const previous = doc.resolve(blockStart).nodeBefore;
  if (!previous || previous.type.name !== "horizontalRule") return null;
  return blockStart - previous.nodeSize;
}

/** Position of the top-level `harvyImage` directly before the block containing `$from`, if any. */
function getHarvyImagePosDirectlyAbove($from: ResolvedPos): number | null {
  if ($from.depth < 1) return null;

  const blockIndex = $from.index(1);
  if (blockIndex <= 0) return null;

  const doc = $from.node(0);
  const previous = doc.child(blockIndex - 1);
  if (previous.type.name !== "harvyImage") return null;

  let imagePos = 0;
  for (let i = 0; i < blockIndex - 1; i++) {
    imagePos += doc.child(i).nodeSize;
  }

  return imagePos;
}

function getHarvyImagePosDirectlyBeforeBlockStart(doc: PMNode, blockStart: number): number | null {
  if (blockStart <= 0) return null;
  const previous = doc.resolve(blockStart).nodeBefore;
  if (!previous || previous.type.name !== "harvyImage") return null;
  return blockStart - previous.nodeSize;
}

/**
 * Backspace on a selected horizontal rule deletes it. Backspace at the start of
 * the following block first selects/highlights the rule (same two-step flow as images).
 */
function handleBackspaceOnHorizontalRule(view: EditorView, event: KeyboardEvent): boolean {
  const { state } = view;
  const { selection } = state;

  if (selection instanceof NodeSelection && selection.node.type.name === "horizontalRule") {
    event.preventDefault();
    const deletePos = selection.from;
    let tr = state.tr.deleteSelection();
    if (!docHasTextBlock(tr.doc)) {
      const paragraph = state.schema.nodes.paragraph;
      if (paragraph) {
        const insertPos = Math.min(deletePos, tr.doc.content.size);
        tr = tr.insert(insertPos, paragraph.create());
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1), 1));
      }
    } else {
      tr = tr.setSelection(
        TextSelection.near(tr.doc.resolve(Math.min(deletePos, tr.doc.content.size)), -1),
      );
    }
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return true;
  }

  if (!(selection instanceof TextSelection) || !selection.empty) return false;
  if (selection.$from.parentOffset !== 0) return false;
  if (selection.$from.depth < 1) return false;

  const hrPos =
    getHorizontalRulePosDirectlyAbove(selection.$from) ??
    getHorizontalRulePosDirectlyBeforeBlockStart(state.doc, selection.$from.before(1));
  if (hrPos == null) return false;

  const hrNode = state.doc.nodeAt(hrPos);
  if (!hrNode || hrNode.type.name !== "horizontalRule") return false;

  event.preventDefault();
  view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, hrPos)).scrollIntoView());
  view.focus();
  return true;
}

/** Where to place the caret after removing a top-level text block at `deletePos`. */
export function findFocusPosAfterTextBlockDelete(doc: PMNode, deletePos: number): number | null {
  const prev = findNearestTextBlockPos(doc, deletePos, -1);
  if (prev != null) return prev;
  return findNearestTextBlockPos(doc, deletePos, 1);
}

/** Delete range for the current empty text block (lifts list items / blockquotes when needed). */
function getEmptyTextBlockDeleteRange(state: EditorState): { from: number; to: number } | null {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;

  const { $from } = selection;
  if (!$from.parent.isTextblock || !isTextBlockEffectivelyEmpty($from.parent)) {
    return null;
  }

  let deleteDepth = $from.depth;

  while (deleteDepth > 1) {
    const parentDepth = deleteDepth - 1;
    const parent = $from.node(parentDepth);
    const childAtDepth = $from.node(deleteDepth);
    if (
      parent.childCount === 1 &&
      parent.firstChild === childAtDepth &&
      (parent.type.name === "listItem" || parent.type.name === "blockquote")
    ) {
      deleteDepth = parentDepth;
      continue;
    }
    break;
  }

  return {
    from: $from.before(deleteDepth),
    to: $from.after(deleteDepth),
  };
}

function applyFocusAfterDelete(
  tr: Transaction,
  schema: EditorState["schema"],
  deletePos: number,
): Transaction {
  const focusPos = findFocusPosAfterTextBlockDelete(tr.doc, deletePos);
  if (focusPos != null) {
    const $focus = tr.doc.resolve(focusPos);
    const preferForward = focusPos >= deletePos;
    return tr.setSelection(TextSelection.near($focus, preferForward ? 1 : -1));
  }

  const paragraph = schema.nodes.paragraph;
  if (!paragraph) {
    return tr.doc.content.size > 0
      ? tr.setSelection(TextSelection.atStart(tr.doc))
      : tr;
  }

  const insertPos = Math.min(deletePos, tr.doc.content.size);
  tr = tr.insert(insertPos, paragraph.create());
  return tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1), 1));
}

/**
 * ProseMirror keydown handler: Backspace on an empty text block deletes the whole block (Notion-style).
 * Returns true when handled (caller should preventDefault).
 */
export function handleBackspaceOnEmptyTextBlockKeyDown(view: EditorView, event: KeyboardEvent): boolean {
  if (event.key !== "Backspace" || event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }

  logSubstackBackspace("Backspace handler fired");

  const { state } = view;
  const { selection } = state;
  const selectionKind =
    selection instanceof NodeSelection
      ? "NodeSelection"
      : selection instanceof TextSelection
        ? "TextSelection"
        : selection.constructor.name;

  logSubstackBackspace("selection", {
    kind: selectionKind,
    nodeType:
      selection instanceof NodeSelection
        ? selection.node.type.name
        : selection.$from.parent.type.name,
  });

  if (selection instanceof NodeSelection && selection.node.type.name === "harvyImage") {
    logSubstackBackspace("delete selected image block");
    event.preventDefault();
    view.dispatch(state.tr.deleteSelection().scrollIntoView());
    view.focus();
    return true;
  }

  if (handleBackspaceOnHorizontalRule(view, event)) {
    logSubstackBackspace("handled horizontal rule backspace");
    return true;
  }

  if (isCursorAtStartOfListItemState(state)) {
    return false;
  }

  if (joinParagraphWithPrecedingListOnBackspace(view)) {
    event.preventDefault();
    return true;
  }

  const range = getEmptyTextBlockDeleteRange(state);
  if (!range) {
    logSubstackBackspace("skip: not an empty text block", {
      parentType: selection.$from.parent.type.name,
      parentText: selection.$from.parent.textContent,
      parentOffset: selection.$from.parentOffset,
      parentEmpty: isTextBlockEffectivelyEmpty(selection.$from.parent),
    });
    return false;
  }

  // Sole empty paragraph: leave it so the empty-doc placeholder (“Start writing…”) stays.
  if (
    state.doc.childCount === 1 &&
    state.doc.firstChild?.isTextblock &&
    isTextBlockEffectivelyEmpty(state.doc.firstChild)
  ) {
    logSubstackBackspace("skip: sole empty paragraph");
    event.preventDefault();
    return true;
  }

  const { from, to } = range;
  const { schema, doc } = state;
  const { $from } = selection;

  const previousNodeType =
    $from.depth >= 1 && $from.index(1) > 0
      ? $from.node(0).child($from.index(1) - 1).type.name
      : null;
  const previousAtBlockStart = doc.resolve(from).nodeBefore?.type.name ?? null;

  logSubstackBackspace("empty block delete range", {
    from,
    to,
    currentNodeType: $from.parent.type.name,
    previousNodeType,
    previousAtBlockStart,
  });

  const imagePosBefore =
    getHarvyImagePosDirectlyAbove($from) ?? getHarvyImagePosDirectlyBeforeBlockStart(doc, from);

  let tr = state.tr.delete(from, to);

  if (imagePosBefore != null) {
    tr = tr.setSelection(NodeSelection.create(tr.doc, imagePosBefore));
    logSubstackBackspace("NodeSelection applied on image", {
      imagePos: imagePosBefore,
      selectedNodeType: tr.doc.nodeAt(imagePosBefore)?.type.name ?? null,
    });
    event.preventDefault();
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return true;
  }

  if (!docHasTextBlock(tr.doc)) {
    const paragraph = schema.nodes.paragraph;
    if (paragraph) {
      const insertPos = Math.min(from, tr.doc.content.size);
      tr = tr.insert(insertPos, paragraph.create());
      tr = tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1), 1));
      logSubstackBackspace("inserted fallback empty paragraph", { insertPos });
    }
  } else {
    tr = applyFocusAfterDelete(tr, schema, from);
  }

  event.preventDefault();
  view.dispatch(tr.scrollIntoView());
  view.focus();

  logSubstackBackspace("deleted empty block without image selection");
  return true;
}
