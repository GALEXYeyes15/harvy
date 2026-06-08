import { isNodeEmpty } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Normal body blocks use the caret only — no left-side pseudo placeholder. */
const PLACEHOLDER_SKIP_NODE_TYPES = new Set(["paragraph", "heading", "blockquote"]);

/**
 * TipTap Placeholder, but empty `harvyOutlineParagraph` placeholders in **writing** mode are decorated
 * by {@link HarvyOutlineParagraph}'s plugin instead (scaffold hint from `writingScaffold`).
 */
export const HarvyPlaceholder = Placeholder.extend({
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("placeholder"),
        props: {
          decorations: ({ doc, selection }) => {
            const active = this.editor.isEditable || !this.options.showOnlyWhenEditable;
            const { anchor } = selection;
            const decorations: Decoration[] = [];

            if (!active) {
              return null;
            }

            const isEmptyDoc = this.editor.isEmpty;

            doc.descendants((node, pos) => {
              if (PLACEHOLDER_SKIP_NODE_TYPES.has(node.type.name)) {
                return this.options.includeChildren;
              }

              /* Outline placeholder blocks use HarvyOutlineParagraph’s decoration (writing) or stay bare (authoring). */
              if (
                node.type.name === "harvyOutlineParagraph" &&
                node.attrs.kind === "placeholder" &&
                !node.isLeaf &&
                isNodeEmpty(node)
              ) {
                return this.options.includeChildren;
              }

              const hasAnchor = anchor >= pos && anchor <= pos + node.nodeSize;
              const isEmpty = !node.isLeaf && isNodeEmpty(node);

              if ((hasAnchor || !this.options.showOnlyCurrent) && isEmpty) {
                const classes = [this.options.emptyNodeClass];

                if (isEmptyDoc) {
                  classes.push(this.options.emptyEditorClass);
                }

                const decoration = Decoration.node(pos, pos + node.nodeSize, {
                  class: classes.join(" "),
                  "data-placeholder":
                    typeof this.options.placeholder === "function"
                      ? this.options.placeholder({
                          editor: this.editor,
                          node,
                          pos,
                          hasAnchor,
                        })
                      : this.options.placeholder,
                });

                decorations.push(decoration);
              }

              return this.options.includeChildren;
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
