import type { Node as PMNode } from "@tiptap/pm/model";
import Placeholder from "@tiptap/extension-placeholder";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { isTextBlockEffectivelyEmpty } from "./emptyTextBlockDeletion";

/**
 * True when the doc has no meaningful writing yet (empty paragraphs / hard breaks only).
 * TipTap’s `editor.isEmpty` is stricter and treats a lone hard break as non-empty, which
 * made “Start writing…” vanish after Backspace.
 */
export function isDocumentVisuallyBlank(doc: PMNode): boolean {
  if (doc.childCount === 0) return true;

  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    if (child.type.name === "paragraph" || child.type.name === "heading") {
      if (!isTextBlockEffectivelyEmpty(child)) return false;
      continue;
    }
    return false;
  }

  return true;
}

/**
 * TipTap Placeholder, but empty `harvyOutlineParagraph` placeholders in **writing** mode are decorated
 * by {@link HarvyOutlineParagraph}'s plugin instead (scaffold hint from `writingScaffold`).
 *
 * Normal paragraphs only get a placeholder when the document is visually blank (e.g. “Start writing…”).
 */
export const HarvyPlaceholder = Placeholder.extend({
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("placeholder"),
        props: {
          decorations: ({ doc, selection }) => {
            const active = this.editor.isEditable || !this.options.showOnlyWhenEditable;
            if (!active || !isDocumentVisuallyBlank(doc)) {
              return null;
            }

            const decorations: Decoration[] = [];
            const { anchor } = selection;
            let decorated = false;

            doc.descendants((node, pos) => {
              if (decorated) return false;
              if (node.type.name !== "paragraph" || !isTextBlockEffectivelyEmpty(node)) {
                return this.options.includeChildren;
              }

              const text =
                typeof this.options.placeholder === "function"
                  ? this.options.placeholder({
                      editor: this.editor,
                      node,
                      pos,
                      hasAnchor: anchor >= pos && anchor <= pos + node.nodeSize,
                    })
                  : this.options.placeholder;

              if (!text) {
                return false;
              }

              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: `${this.options.emptyNodeClass} ${this.options.emptyEditorClass}`,
                  "data-placeholder": text,
                }),
              );
              decorated = true;
              return false;
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
