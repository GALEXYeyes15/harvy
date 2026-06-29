import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Fragment, Slice, type Mark, type Node as PMNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";

/** Inline marks stripped on paste so clipboard HTML behaves like "Paste and Match Style". */
const FORMATTING_MARK_NAMES = new Set([
  "bold",
  "italic",
  "underline",
  "link",
  "code",
  "strike",
]);

function stripFormattingMarks(marks: readonly Mark[]): Mark[] {
  return marks.filter((mark) => !FORMATTING_MARK_NAMES.has(mark.type.name));
}

function stripMarksFromFragment(fragment: Fragment): Fragment {
  const children: PMNode[] = [];

  fragment.forEach((node) => {
    if (node.isText) {
      const text = node.text ?? "";
      if (!text) {
        return;
      }
      children.push(node.type.schema.text(text, stripFormattingMarks(node.marks)));
      return;
    }

    if (node.isLeaf) {
      const marks = stripFormattingMarks(node.marks);
      children.push(marks.length === node.marks.length ? node : node.mark(marks));
      return;
    }

    children.push(node.copy(stripMarksFromFragment(node.content)));
  });

  return Fragment.fromArray(children);
}

export function stripFormattingFromPastedSlice(slice: Slice): Slice {
  return new Slice(
    stripMarksFromFragment(slice.content),
    slice.openStart,
    slice.openEnd,
  );
}

const UNWRAP_SELECTOR =
  "em,i,strong,b,u,s,strike,del,code,a,span,font,sub,sup,small,big";

function unwrapElement(el: Element): void {
  const parent = el.parentNode;
  if (!parent) {
    return;
  }
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  parent.removeChild(el);
}

/** Remove inline formatting from clipboard HTML before ProseMirror parses it. */
export function stripInlineFormattingFromHtml(html: string): string {
  if (!html.trim()) {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.body;

  root.querySelectorAll("[style]").forEach((el) => el.removeAttribute("style"));
  root.querySelectorAll("[class]").forEach((el) => el.removeAttribute("class"));

  const toUnwrap = Array.from(root.querySelectorAll(UNWRAP_SELECTOR));
  toUnwrap.sort((a, b) => {
    const depth = (el: Element) => {
      let d = 0;
      for (let n: Element | null = el; n; n = n.parentElement) {
        d += 1;
      }
      return d;
    };
    return depth(b) - depth(a);
  });

  for (const el of toUnwrap) {
    if (el.parentNode) {
      unwrapElement(el);
    }
  }

  return root.innerHTML;
}

function clearFormattingStoredMarks(view: EditorView): void {
  const { storedMarks } = view.state;
  if (!storedMarks?.length) {
    return;
  }
  const kept = stripFormattingMarks(storedMarks);
  if (kept.length === storedMarks.length) {
    return;
  }
  view.dispatch(view.state.tr.setStoredMarks(kept.length ? kept : null));
}

/**
 * Default paste: plain text with block structure (paragraphs, lists, line breaks).
 * Strips bold/italic/underline/links and other inline marks from clipboard HTML
 * so pasted content does not inherit source-document or active-cursor formatting.
 */
export const HarvyPlainPaste = Extension.create({
  name: "harvyPlainPaste",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          transformPastedHTML(html) {
            return stripInlineFormattingFromHtml(html);
          },
          transformPasted(slice) {
            return stripFormattingFromPastedSlice(slice);
          },
          handlePaste(view, _event, _slice) {
            clearFormattingStoredMarks(view);
            return false;
          },
        },
      }),
    ];
  },
});
