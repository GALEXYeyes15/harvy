import type { Editor } from "@tiptap/core";
import { Extension, isNodeEmpty } from "@tiptap/core";
import type { Command, EditorState, Transaction } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";
import { liftListItem as pmLiftListItem, sinkListItem as pmSinkListItem } from "@tiptap/pm/schema-list";
import { joinParagraphWithPrecedingList } from "./joinParagraphWithPrecedingList";
import {
  clearListItemIndentInTr,
  countListStructuralDepth,
  findListItemAtCursor,
  findPreviousListItemTextblockEnd,
  getIndentLevel,
  isFirstItemInParentList,
  setListItemIndentInTr,
  setSelectionAtMappedBlockStart,
} from "./listItemIndent";

/** Collapsed cursor at offset 0 inside a list item text block. */
export function isCursorAtStartOfListItemState(state: EditorState): boolean {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) {
    return false;
  }

  const { $from } = selection;
  if (!$from.parent.isTextblock || $from.parentOffset !== 0) return false;

  return findListItemAtCursor($from) != null;
}

function isNestedListItemAtCursor(state: EditorState): boolean {
  if (!isCursorAtStartOfListItemState(state)) return false;

  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name === "bulletList" || name === "orderedList") {
      return d >= 2 && $from.node(d - 1).type.name === "listItem";
    }
  }
  return false;
}

function isEmptyListItemParagraph(editor: Editor): boolean {
  const { $from } = editor.state.selection;

  if (!findListItemAtCursor($from)) return false;
  if ($from.parent.type.name !== "paragraph") return false;
  if ($from.parentOffset !== 0) return false;
  return isNodeEmpty($from.parent);
}

function runListItemCommandKeepingCursorAtStart(
  editor: Editor,
  command: Command,
  shouldRun: (state: EditorState) => boolean = isCursorAtStartOfListItemState,
  afterTransaction?: (tr: Transaction) => void,
): boolean {
  const { state, view } = editor;
  if (!shouldRun(state)) return false;

  const listItem = state.schema.nodes.listItem;
  if (!listItem) return false;

  const cursorPos = state.selection.$from.start();

  return command(state, (tr) => {
    afterTransaction?.(tr);
    setSelectionAtMappedBlockStart(tr, cursorPos);
    view.dispatch(tr.scrollIntoView());
  });
}

function liftListItemWithCursorAtStart(editor: Editor): boolean {
  const listItem = editor.state.schema.nodes.listItem;
  if (!listItem) return false;
  return runListItemCommandKeepingCursorAtStart(editor, pmLiftListItem(listItem));
}

function liftNestedListItemWithCursorAtStart(editor: Editor): boolean {
  const listItem = editor.state.schema.nodes.listItem;
  if (!listItem) return false;
  return runListItemCommandKeepingCursorAtStart(editor, pmLiftListItem(listItem), isNestedListItemAtCursor);
}

function adjustListItemIndentAtCursor(editor: Editor, delta: number): boolean {
  const { state, view } = editor;
  if (!isCursorAtStartOfListItemState(state)) return false;

  const { $from } = state.selection;
  const found = findListItemAtCursor($from);
  if (!found) return false;

  const currentIndent = (found.node.attrs.indentLevel as number | undefined) ?? 0;
  const nextIndent = currentIndent + delta;
  if (nextIndent < 0) return false;

  const structuralDepth = countListStructuralDepth($from, found.depth);
  const cursorPos = $from.start();
  const tr = state.tr;
  setListItemIndentInTr(tr, found, nextIndent, structuralDepth);
  setSelectionAtMappedBlockStart(tr, cursorPos);
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** Empty paragraph is a second+ block inside the same list item — delete it, keep cursor on prior line. */
function mergeEmptyParagraphBackwardInListItem(editor: Editor): boolean {
  const { state, view } = editor;
  const { $from } = state.selection;
  const found = findListItemAtCursor($from);
  if (!found || found.node.childCount <= 1) return false;

  const blockStart = $from.before($from.depth);
  const blockEnd = $from.after($from.depth);

  let previousTextEnd: number | null = null;
  state.doc.nodesBetween(found.pos, blockStart, (node, pos) => {
    if (!node.isTextblock || pos + node.nodeSize > blockStart) return;
    previousTextEnd = pos + 1 + node.content.size;
  });

  if (previousTextEnd == null) return false;

  const tr = state.tr.delete(blockStart, blockEnd);
  tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(previousTextEnd, -1)));
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** Lift an empty nested list item one level; keep it empty with caret at block start. */
function liftEmptyNestedListItemKeepingCursor(editor: Editor): boolean {
  const listItem = editor.state.schema.nodes.listItem;
  if (!listItem) return false;

  const { state, view } = editor;
  const cursorPos = state.selection.$from.start();

  return pmLiftListItem(listItem)(state, (tr) => {
    const mapped = tr.mapping.map(cursorPos, 1);
    const bounded = Math.min(Math.max(1, mapped), Math.max(1, tr.doc.content.size - 1));
    const $pos = tr.doc.resolve(bounded);
    const start = $pos.parent.isTextblock ? $pos.start() : TextSelection.near($pos, 1).$from.start();
    tr.setSelection(TextSelection.create(tr.doc, start));
    view.dispatch(tr.scrollIntoView());
  });
}

/** Remove a top-level empty list item and move the caret to the previous list line. */
function deleteEmptyTopLevelListItemMergeToPrevious(editor: Editor): boolean {
  const { state, view } = editor;
  const { $from } = state.selection;
  const found = findListItemAtCursor($from);
  if (!found) return false;

  const listItemStart = found.pos;
  const listItemEnd = found.pos + found.node.nodeSize;
  const previousTextEnd = findPreviousListItemTextblockEnd(state.doc, listItemStart);

  if (previousTextEnd == null) {
    return liftListItemWithCursorAtStart(editor);
  }

  const tr = state.tr.delete(listItemStart, listItemEnd);
  tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map(previousTextEnd, -1)));
  view.dispatch(tr.scrollIntoView());
  return true;
}

function handleEmptyListItemBackspace(editor: Editor): boolean {
  if (!isEmptyListItemParagraph(editor)) return false;

  if (getIndentLevel(editor.state) > 0) {
    return adjustListItemIndentAtCursor(editor, -1);
  }

  const found = findListItemAtCursor(editor.state.selection.$from);
  if (!found) return false;

  if (found.node.childCount > 1) {
    return mergeEmptyParagraphBackwardInListItem(editor);
  }

  if (isNestedListItemAtCursor(editor.state)) {
    return liftEmptyNestedListItemKeepingCursor(editor);
  }

  return deleteEmptyTopLevelListItemMergeToPrevious(editor);
}

function sinkOrIndentListItemAtStart(editor: Editor): boolean {
  const { state, view } = editor;
  if (!isCursorAtStartOfListItemState(state)) return false;

  const listItem = state.schema.nodes.listItem;
  if (!listItem) return false;

  const { $from } = state.selection;
  const cursorPos = $from.start();
  const sink = pmSinkListItem(listItem);

  if (sink(state, undefined)) {
    return sink(state, (tr) => {
      setSelectionAtMappedBlockStart(tr, cursorPos);
      const $mapped = tr.selection.$from;
      clearListItemIndentInTr(tr, $mapped);
      view.dispatch(tr.scrollIntoView());
    });
  }

  if (!isFirstItemInParentList($from, findListItemAtCursor($from)!.depth)) {
    return false;
  }

  return adjustListItemIndentAtCursor(editor, 1);
}

/**
 * Notion-like list editing:
 * - Enter on an empty item exits the list
 * - Backspace at the start of any list item outdents or converts to a paragraph
 * - Tab / Shift+Tab at the start of a list item nest / unnest one level
 */
export const HarvyListKeyboard = Extension.create({
  name: "harvyListKeyboard",
  priority: 10001,

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        if (!isEmptyListItemParagraph(this.editor)) return false;
        return this.editor.commands.liftListItem("listItem");
      },
      Backspace: () => {
        const { editor } = this;

        if (handleEmptyListItemBackspace(editor)) {
          return true;
        }

        if (
          joinParagraphWithPrecedingList(editor.state, (tr) => {
            editor.view.dispatch(tr);
          })
        ) {
          return true;
        }

        if (isCursorAtStartOfListItemState(editor.state)) {
          if (getIndentLevel(editor.state) > 0) {
            return adjustListItemIndentAtCursor(editor, -1);
          }
          return liftListItemWithCursorAtStart(editor);
        }

        return false;
      },
      Tab: () => sinkOrIndentListItemAtStart(this.editor),
      "Shift-Tab": () => {
        if (!isCursorAtStartOfListItemState(this.editor.state)) return false;
        if (isNestedListItemAtCursor(this.editor.state)) {
          return liftNestedListItemWithCursorAtStart(this.editor);
        }
        if (getIndentLevel(this.editor.state) > 0) {
          return adjustListItemIndentAtCursor(this.editor, -1);
        }
        return true;
      },
    };
  },
});
