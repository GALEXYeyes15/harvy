import { isNodeEmpty, mergeAttributes, Node } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Fragment, Slice } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type HarvyOutlineKind = "placeholder" | "instruction";

const harvyOutlinePluginKey = new PluginKey("harvyOutlinePlaceholderWriting");

function findEnclosingHarvyPlaceholder(
  state: EditorState,
  pos: number,
): { pos: number; node: PMNode } | null {
  const $pos = state.doc.resolve(pos);
  for (let d = $pos.depth; d >= 1; d--) {
    const node = $pos.node(d);
    if (node.type.name === "harvyOutlineParagraph" && node.attrs.kind === "placeholder") {
      return { pos: $pos.before(d), node };
    }
  }
  return null;
}

function isCreateOutlineMode(editor: { storage: { harvyOutlineParagraph?: { createOutlineMode?: boolean } } }): boolean {
  return editor.storage.harvyOutlineParagraph?.createOutlineMode ?? false;
}

/**
 * Promote empty writing-mode placeholder on text input: one transaction replaces the block
 * and inserts the typed text with an explicit selection (no follow-up appendTransaction).
 */
function handlePlaceholderTextInput(
  view: EditorView,
  editor: { storage: { harvyOutlineParagraph?: { createOutlineMode?: boolean } } },
  text: string,
): boolean {
  if (!text || /[\r\n]/.test(text)) {
    return false;
  }
  if (isCreateOutlineMode(editor)) {
    return false;
  }

  const state = view.state;
  const sel = state.selection;
  if (!(sel instanceof TextSelection) || !sel.empty) {
    return false;
  }

  const found = findEnclosingHarvyPlaceholder(state, sel.$from.pos);
  if (!found || !isNodeEmpty(found.node)) {
    return false;
  }

  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType) {
    return false;
  }

  const scaffoldHint = (found.node.attrs.writingScaffold as string | null) ?? "";
  const marks = state.storedMarks || sel.$from.marks();
  const textNode = state.schema.text(text, marks);
  const paragraph = paragraphType.create({ harvyRestorableScaffold: scaffoldHint }, Fragment.from(textNode));

  const tr = state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, paragraph);
  const endPos = found.pos + 1 + text.length;
  tr.setSelection(TextSelection.create(tr.doc, endPos));
  view.dispatch(tr.scrollIntoView());
  return true;
}

function handlePlaceholderPaste(
  view: EditorView,
  editor: { storage: { harvyOutlineParagraph?: { createOutlineMode?: boolean } } },
  event: ClipboardEvent,
  slice: Slice,
): boolean {
  if (isCreateOutlineMode(editor)) {
    return false;
  }

  const state = view.state;
  const sel = state.selection;
  if (!(sel instanceof TextSelection) || !sel.empty) {
    return false;
  }

  const found = findEnclosingHarvyPlaceholder(state, sel.$from.pos);
  if (!found || !isNodeEmpty(found.node)) {
    return false;
  }

  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType) {
    return false;
  }

  const scaffoldHint = (found.node.attrs.writingScaffold as string | null) ?? "";
  const marks = state.storedMarks || sel.$from.marks();

  let pasted = slice.content.textBetween(0, slice.content.size, "\n", "\n");
  if (!pasted) {
    pasted = event.clipboardData?.getData("text/plain") ?? "";
  }
  pasted = pasted.replace(/\r\n/g, "\n");
  if (!pasted) {
    return false;
  }

  const textNode = state.schema.text(pasted, marks);
  const paragraph = paragraphType.create({ harvyRestorableScaffold: scaffoldHint }, Fragment.from(textNode));

  const tr = state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, paragraph);
  const endPos = found.pos + 1 + pasted.length;
  tr.setSelection(TextSelection.create(tr.doc, endPos));
  view.dispatch(tr.scrollIntoView().setMeta("paste", true).setMeta("uiEvent", "paste"));
  return true;
}

/**
 * Block paragraphs for outline scaffold (stats/export treat separately from body copy).
 *
 * **Create Outline Mode ON:** placeholder `content` is the definitional text.
 * **Create Outline Mode OFF:** placeholder `content` is empty; `writingScaffold` drives hints;
 * {@link handlePlaceholderTextInput} / {@link handlePlaceholderPaste} promote in the same step as input.
 */
export const HarvyOutlineParagraph = Node.create({
  name: "harvyOutlineParagraph",
  group: "block",
  content: "inline*",
  defining: true,
  priority: 1100,

  addStorage() {
    return {
      createOutlineMode: false,
    };
  },

  addAttributes() {
    return {
      kind: {
        default: "placeholder" as HarvyOutlineKind,
      },
      /** Hint shown when the block is empty in writing mode (normal editing). */
      writingScaffold: {
        default: null as string | null,
      },
    };
  },

  addProseMirrorPlugins() {
    const ext = this;

    return [
      new Plugin({
        key: harvyOutlinePluginKey,
        props: {
          decorations(state) {
            const createOutlineMode = ext.editor?.storage?.harvyOutlineParagraph?.createOutlineMode ?? false;
            if (createOutlineMode) {
              return DecorationSet.empty;
            }

            const { doc } = state;
            const decorations: Decoration[] = [];

            doc.descendants((node, pos) => {
              if (node.type.name !== "harvyOutlineParagraph" || node.attrs.kind !== "placeholder") {
                return true;
              }
              if (!isNodeEmpty(node)) {
                return true;
              }

              const hint = ((node.attrs.writingScaffold as string | null) ?? "").trim() || "…";

              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: "is-empty harvy-outline-writing-scaffold",
                  "data-placeholder": hint,
                }),
              );
              return true;
            });

            return DecorationSet.create(doc, decorations);
          },

          handleTextInput(view, _from, _to, text, _defaultInsert) {
            if (!ext.editor) {
              return false;
            }
            return handlePlaceholderTextInput(view, ext.editor, text);
          },

          handlePaste(view, event, slice) {
            if (!ext.editor) {
              return false;
            }
            return handlePlaceholderPaste(view, ext.editor, event, slice);
          },
        },

        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) {
            return null;
          }

          const createOutlineMode = ext.editor?.storage?.harvyOutlineParagraph?.createOutlineMode ?? false;
          if (createOutlineMode) {
            return null;
          }

          const outlineType = newState.schema.nodes.harvyOutlineParagraph;
          const paragraphType = newState.schema.nodes.paragraph;
          if (!outlineType || !paragraphType) {
            return null;
          }

          /** Restoration only (empty promoted paragraph → placeholder). Promotion runs in handleTextInput/handlePaste. */
          const toRestore: { pos: number; node: PMNode }[] = [];

          newState.doc.descendants((node, pos) => {
            if (node.type === paragraphType && isNodeEmpty(node)) {
              const raw = node.attrs.harvyRestorableScaffold as string | null | undefined;
              if (raw != null && raw.length > 0) {
                toRestore.push({ pos, node });
              }
            }
            return true;
          });

          if (toRestore.length === 0) {
            return null;
          }

          toRestore.sort((a, b) => b.pos - a.pos);

          const tr = newState.tr;
          for (const { pos, node } of toRestore) {
            const scaffold = String(node.attrs.harvyRestorableScaffold ?? "");
            const outline = outlineType.create(
              { kind: "placeholder", writingScaffold: scaffold },
              Fragment.empty,
            );
            tr.replaceWith(pos, pos + node.nodeSize, outline);
          }

          const mappedSelection = newState.selection.map(tr.doc, tr.mapping);
          tr.setSelection(mappedSelection);
          return tr;
        },
      }),
    ];
  },

  parseHTML() {
    return [
      {
        tag: 'p[data-harvy-outline-kind="placeholder"]',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) {
            return false;
          }
          const scaffold =
            el.getAttribute("data-harvy-outline-scaffold") ?? el.getAttribute("data-harvy-outline-seed");
          return {
            kind: "placeholder" as const,
            writingScaffold: scaffold,
          };
        },
      },
      {
        tag: 'p[data-harvy-outline-kind="instruction"]',
        getAttrs: () => ({
          kind: "instruction" as const,
          writingScaffold: null,
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = node.attrs.kind as HarvyOutlineKind;
    const writingScaffold = node.attrs.writingScaffold as string | null;
    const cls =
      kind === "instruction" ? "harvy-outline-instruction" : "harvy-outline-placeholder";
    const extra: Record<string, string> = {
      "data-harvy-outline-kind": kind,
      class: cls,
    };
    if (kind === "placeholder" && writingScaffold) {
      extra["data-harvy-outline-scaffold"] = writingScaffold;
    }
    return ["p", mergeAttributes(HTMLAttributes, extra), 0];
  },
});
