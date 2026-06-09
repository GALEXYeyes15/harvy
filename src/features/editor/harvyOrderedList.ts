import OrderedList from "@tiptap/extension-ordered-list";
import { Plugin } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";

export type HarvyOrderedListDelimiter = "period" | "paren";

function parentOrderedListDelimiter(doc: EditorState["doc"], listPos: number): HarvyOrderedListDelimiter | null {
  const $pos = doc.resolve(listPos + 1);
  for (let d = $pos.depth - 1; d > 0; d--) {
    if ($pos.before(d) === listPos) continue;
    const node = $pos.node(d);
    if (node.type.name === "orderedList") {
      const raw = node.attrs.delimiter as string | undefined;
      return raw === "paren" ? "paren" : "period";
    }
  }
  return null;
}

function inheritNestedOrderedListDelimiters(state: EditorState): Transaction | null {
  let tr = state.tr;
  let changed = false;

  state.doc.descendants((node, pos) => {
    if (node.type.name !== "orderedList") return;

    const inherited = parentOrderedListDelimiter(state.doc, pos);
    if (inherited == null) return;

    const current = (node.attrs.delimiter as string | undefined) === "paren" ? "paren" : "period";
    if (current === inherited) return;

    tr = tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      delimiter: inherited,
    });
    changed = true;
  });

  return changed ? tr : null;
}

/**
 * Ordered lists with period (`1.`) or parenthesis (`1)`) marker delimiters.
 */
export const HarvyOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      delimiter: {
        default: "period" as HarvyOrderedListDelimiter,
        parseHTML: (element) => (element.getAttribute("data-delimiter") === "paren" ? "paren" : "period"),
        renderHTML: (attributes) => {
          const delimiter = attributes.delimiter as HarvyOrderedListDelimiter | undefined;
          return { "data-delimiter": delimiter === "paren" ? "paren" : "period" };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((t) => t.docChanged)) return null;
          return inheritNestedOrderedListDelimiters(newState);
        },
      }),
    ];
  },
});
