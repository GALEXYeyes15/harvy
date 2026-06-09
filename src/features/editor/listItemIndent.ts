import type { Node as PMNode } from "@tiptap/pm/model";
import type { ResolvedPos } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";

export type ListItemAtCursor = {
  depth: number;
  pos: number;
  node: PMNode;
};

export function findListItemAtCursor($from: ResolvedPos): ListItemAtCursor | null {
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "listItem") {
      return {
        depth: d,
        pos: $from.before(d),
        node: $from.node(d),
      };
    }
  }
  return null;
}

/** Number of `bulletList` / `orderedList` ancestors wrapping the list item. */
export function countListStructuralDepth($from: ResolvedPos, listItemDepth: number): number {
  let count = 0;
  for (let d = listItemDepth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name === "bulletList" || name === "orderedList") count++;
  }
  return count;
}

export function isFirstItemInParentList($from: ResolvedPos, listItemDepth: number): boolean {
  for (let d = listItemDepth - 1; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name === "bulletList" || name === "orderedList") {
      return $from.index(d) === 0;
    }
  }
  return false;
}

export function getIndentLevel(state: EditorState): number {
  const { $from } = state.selection;
  const found = findListItemAtCursor($from);
  if (!found) return 0;
  const level = found.node.attrs.indentLevel as number | undefined;
  return level && level > 0 ? level : 0;
}

export function visualDepthFor(structuralDepth: number, indentLevel: number): number {
  return structuralDepth + indentLevel;
}

/** Last textblock inside a listItem that ends before `beforePos` (document order). */
export function findPreviousListItemTextblockEnd(doc: PMNode, beforePos: number): number | null {
  if (beforePos <= 1) return null;

  let lastEnd: number | null = null;

  doc.nodesBetween(0, beforePos, (node, pos) => {
    if (!node.isTextblock) return;

    const $r = doc.resolve(pos + 1);
    for (let d = $r.depth; d > 0; d--) {
      if ($r.node(d).type.name === "listItem") {
        lastEnd = pos + 1 + node.content.size;
        return;
      }
    }
  });

  return lastEnd;
}

export function setSelectionAtMappedBlockStart(tr: Transaction, cursorPos: number): void {
  const mapped = tr.mapping.map(cursorPos, -1);
  const bounded = Math.min(Math.max(1, mapped), Math.max(1, tr.doc.content.size - 1));
  const $pos = tr.doc.resolve(bounded);
  const start = $pos.parent.isTextblock ? $pos.start() : TextSelection.near($pos, -1).$from.start();
  tr.setSelection(TextSelection.create(tr.doc, start));
}

export function clearListItemIndentInTr(tr: Transaction, $from: ResolvedPos): Transaction {
  const found = findListItemAtCursor($from);
  if (!found) return tr;

  const indentLevel = (found.node.attrs.indentLevel as number | undefined) ?? 0;
  const harvyVisualDepth = found.node.attrs.harvyVisualDepth as number | null | undefined;
  if (indentLevel <= 0 && (harvyVisualDepth == null || harvyVisualDepth <= 0)) {
    return tr;
  }

  const mappedPos = tr.mapping.map(found.pos);
  return tr.setNodeMarkup(mappedPos, undefined, {
    ...found.node.attrs,
    indentLevel: 0,
    harvyVisualDepth: null,
  });
}

export function setListItemIndentInTr(
  tr: Transaction,
  found: ListItemAtCursor,
  indentLevel: number,
  structuralDepth: number,
): Transaction {
  const mappedPos = tr.mapping.map(found.pos);
  const node = tr.doc.nodeAt(mappedPos);
  if (!node || node.type.name !== "listItem") return tr;

  if (indentLevel <= 0) {
    return tr.setNodeMarkup(mappedPos, undefined, {
      ...node.attrs,
      indentLevel: 0,
      harvyVisualDepth: null,
    });
  }

  return tr.setNodeMarkup(mappedPos, undefined, {
    ...node.attrs,
    indentLevel,
    harvyVisualDepth: visualDepthFor(structuralDepth, indentLevel),
  });
}
