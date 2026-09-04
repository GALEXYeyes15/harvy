import type { Node as PMNode } from "@tiptap/pm/model";
import type { ResolvedPos } from "@tiptap/pm/model";
import type { EditorState } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { findListItemAtCursor, findPreviousListItemTextblockEnd } from "./listItemIndent";

function isParagraphEffectivelyEmpty(node: PMNode): boolean {
  if (!node.isTextblock || node.content.size === 0) return true;

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

/** Temporary — remove after verifying Backspace-after-list merge. */
const JOIN_LIST_BACKSPACE_DEBUG = true;

function logJoinListBackspace(state: EditorState, step: string, detail?: Record<string, unknown>): void {
  if (!JOIN_LIST_BACKSPACE_DEBUG) return;

  const { selection } = state;
  const $from = selection.$from;
  const path: { depth: number; type: string; index: number }[] = [];
  for (let d = 0; d <= $from.depth; d++) {
    path.push({ depth: d, type: $from.node(d).type.name, index: $from.index(d) });
  }

  const blockPos = $from.before($from.depth);
  const $cut = blockPos > 0 ? state.doc.resolve(blockPos) : null;

  const snapFrom = Math.max(0, $from.pos - 30);
  const snapTo = Math.min(state.doc.content.size, $from.pos + 30);

  console.log("[HarvyJoinListBackspace]", step, {
    selectionPos: $from.pos,
    parentType: $from.parent.type.name,
    parentDepth: $from.depth,
    parentOffset: $from.parentOffset,
    blockType: $from.parent.type.name,
    previousSiblingType: $cut?.nodeBefore?.type.name ?? null,
    resolvedPath: path,
    docSnapshot: state.doc.slice(snapFrom, snapTo).content.toJSON(),
    ...detail,
  });
}

function isInsideListItem($from: ResolvedPos): boolean {
  return findListItemAtCursor($from) != null;
}

function isListNode(node: PMNode | null | undefined): boolean {
  const name = node?.type.name;
  return name === "bulletList" || name === "orderedList";
}

type JoinTarget = {
  blockStart: number;
  blockEnd: number;
  previousTextEnd: number;
  paragraphEmpty: boolean;
};

function resolveJoinTarget(state: EditorState): JoinTarget | null {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;

  const { $from } = selection;
  if (!$from.parent.isTextblock || $from.parentOffset !== 0) return null;
  if ($from.parent.type.name !== "paragraph") return null;

  const blockStart = $from.before($from.depth);
  const blockEnd = $from.after($from.depth);
  const paragraphEmpty = isParagraphEffectivelyEmpty($from.parent);
  // Only merge when this paragraph sits directly after a list. A body block
  // between the list and this paragraph must keep the caret.
  const topIndex = $from.index(0);
  const previousTopLevel = topIndex > 0 ? $from.node(0).child(topIndex - 1) : null;
  if (!isListNode(previousTopLevel)) return null;

  const previousTextEnd = findPreviousListItemTextblockEnd(state.doc, blockStart);
  const insideList = isInsideListItem($from);

  if (previousTextEnd == null || previousTextEnd >= blockStart) return null;
  // List-item Backspace handles all in-list cases (nested lift, top-level delete, etc.).
  if (insideList) return null;

  return {
    blockStart,
    blockEnd,
    previousTextEnd,
    paragraphEmpty,
  };
}

export function canJoinParagraphWithPrecedingList(state: EditorState): boolean {
  const target = resolveJoinTarget(state);
  const ok = target != null;
  logJoinListBackspace(state, ok ? "canJoin: yes" : "canJoin: no", { target });
  return ok;
}

/**
 * Merge or remove a paragraph at offset 0 into the preceding list's last visible item.
 */
export function joinParagraphWithPrecedingList(
  state: EditorState,
  dispatch?: (tr: import("@tiptap/pm/state").Transaction) => void,
): boolean {
  const target = resolveJoinTarget(state);
  logJoinListBackspace(state, "join attempt", { target });

  if (!target) return false;
  if (!dispatch) return true;

  const { blockStart, blockEnd, previousTextEnd, paragraphEmpty } = target;
  const paragraphContent = state.selection.$from.parent.content;

  const tr = state.tr;

  if (!paragraphEmpty && paragraphContent.size > 0) {
    tr.insert(previousTextEnd, paragraphContent);
  }

  const mappedBlockStart = tr.mapping.map(blockStart);
  const mappedBlockEnd = tr.mapping.map(blockEnd);
  tr.delete(mappedBlockStart, mappedBlockEnd);

  const cursorPos = paragraphEmpty
    ? tr.mapping.map(previousTextEnd, -1)
    : previousTextEnd;

  tr.setSelection(TextSelection.create(tr.doc, cursorPos));
  logJoinListBackspace(state.apply(tr), "join applied", { cursorPos });
  dispatch(tr.scrollIntoView());
  return true;
}

export function joinParagraphWithPrecedingListOnBackspace(view: EditorView): boolean {
  logJoinListBackspace(view.state, "keydown handler");
  return joinParagraphWithPrecedingList(view.state, (tr) => {
    view.dispatch(tr);
    view.focus();
  });
}
