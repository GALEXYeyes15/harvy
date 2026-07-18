import { Extension } from "@tiptap/core";
import { Fragment, Slice, type Node as PMNode, type Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

function normalizePlainText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function clipboardHasImageFiles(event: ClipboardEvent): boolean {
  const files = event.clipboardData?.files;
  if (!files?.length) return false;
  for (let i = 0; i < files.length; i++) {
    if (files[i]!.type.startsWith("image/")) return true;
  }
  return false;
}

function inlineNodesForLine(schema: Schema, line: string): PMNode[] {
  const hardBreak = schema.nodes.hardBreak;
  const parts = line.split("\n");
  const nodes: PMNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) {
      nodes.push(schema.text(parts[i]!));
    }
    if (i < parts.length - 1 && hardBreak) {
      nodes.push(hardBreak.create());
    }
  }
  return nodes;
}

function plainTextToSlice(schema: Schema, text: string): Slice {
  const normalized = normalizePlainText(text);
  const paragraph = schema.nodes.paragraph;
  if (!paragraph) {
    return new Slice(Fragment.from(schema.text(normalized)), 0, 0);
  }

  // Do not use /\n\n+/ — that collapses intentional blank lines.
  const parts = normalized.split("\n\n");
  const nodes: PMNode[] = [];

  for (const part of parts) {
    let rest = part;
    while (rest.startsWith("\n")) {
      nodes.push(paragraph.create());
      rest = rest.slice(1);
    }
    const inline = inlineNodesForLine(schema, rest);
    nodes.push(paragraph.create(null, inline.length ? Fragment.from(inline) : undefined));
  }

  if (nodes.length === 0) {
    nodes.push(paragraph.create());
  }

  return new Slice(Fragment.from(nodes), 0, 0);
}

function stripMarksFromFragment(fragment: Fragment): Fragment {
  const children: PMNode[] = [];
  fragment.forEach((node) => {
    if (node.isText) {
      children.push(node.marks.length ? node.mark([]) : node);
    } else if (node.content.size) {
      children.push(node.copy(stripMarksFromFragment(node.content)));
    } else {
      children.push(node);
    }
  });
  return Fragment.fromArray(children);
}

function stripMarksFromSlice(slice: Slice): Slice {
  return new Slice(stripMarksFromFragment(slice.content), slice.openStart, slice.openEnd);
}

function getPlainTextFromClipboard(event: ClipboardEvent, slice: Slice): string {
  let plain = event.clipboardData?.getData("text/plain") ?? "";
  plain = normalizePlainText(plain);
  if (!plain) {
    plain = normalizePlainText(slice.content.textBetween(0, slice.content.size, "\n", "\n"));
  }
  return plain;
}

function handlePlainTextPaste(view: EditorView, event: ClipboardEvent, slice: Slice): boolean {
  if (clipboardHasImageFiles(event)) {
    return false;
  }

  const plain = getPlainTextFromClipboard(event, slice);
  if (!plain) {
    return false;
  }

  event.preventDefault();

  const { state } = view;
  const insertSlice = plainTextToSlice(state.schema, plain);
  const tr = state.tr.replaceSelection(insertSlice);
  tr.setStoredMarks([]);
  view.dispatch(tr.scrollIntoView().setMeta("paste", true).setMeta("uiEvent", "paste"));
  return true;
}

/**
 * Default paste behaves like "Paste and Match Style": plain text only, no inherited marks.
 * Outline placeholder paste is handled separately in {@link HarvyOutlineParagraph}.
 */
export const PlainTextPaste = Extension.create({
  name: "plainTextPaste",
  priority: 500,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("plainTextPaste"),
        props: {
          handlePaste(view, event, slice) {
            return handlePlainTextPaste(view, event, slice);
          },
          transformPasted(slice) {
            return stripMarksFromSlice(slice);
          },
        },
      }),
    ];
  },
});
