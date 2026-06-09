import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";

export type LinkEditorSelectionRange = {
  from: number;
  to: number;
};

type LinkEditorSelectionHighlightState = LinkEditorSelectionRange | null;

type LinkEditorSelectionHighlightMeta =
  | { set: LinkEditorSelectionRange }
  | { clear: true };

export const linkEditorSelectionHighlightKey = new PluginKey<LinkEditorSelectionHighlightState>(
  "harvyLinkEditorSelectionHighlight",
);

function isValidRange(view: EditorView, from: number, to: number): boolean {
  if (from < 0 || to <= from) return false;
  const size = view.state.doc.content.size;
  return from <= size && to <= size;
}

export const LinkEditorSelectionHighlight = Extension.create({
  name: "linkEditorSelectionHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<LinkEditorSelectionHighlightState>({
        key: linkEditorSelectionHighlightKey,
        state: {
          init: () => null,
          apply(tr, oldState) {
            const meta = tr.getMeta(linkEditorSelectionHighlightKey) as
              | LinkEditorSelectionHighlightMeta
              | undefined;

            if (meta && "clear" in meta && meta.clear) {
              return null;
            }
            if (meta && "set" in meta && meta.set) {
              return meta.set;
            }
            if (oldState && tr.docChanged) {
              const from = tr.mapping.map(oldState.from);
              const to = tr.mapping.map(oldState.to, -1);
              if (from < to) return { from, to };
              return null;
            }
            return oldState;
          },
        },
        props: {
          decorations(state) {
            const range = linkEditorSelectionHighlightKey.getState(state);
            if (!range || range.from >= range.to) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.inline(range.from, range.to, {
                class: "harvy-link-editor-selection",
              }),
            ]);
          },
        },
      }),
    ];
  },
});

export function setLinkEditorSelectionHighlight(
  view: EditorView,
  from: number,
  to: number,
): void {
  if (!view?.dom || !isValidRange(view, from, to)) return;
  const tr = view.state.tr.setMeta(linkEditorSelectionHighlightKey, {
    set: { from, to },
  } satisfies LinkEditorSelectionHighlightMeta);
  view.dispatch(tr);
}

export function clearLinkEditorSelectionHighlight(view: EditorView | null | undefined): void {
  if (!view?.dom) return;
  const tr = view.state.tr.setMeta(linkEditorSelectionHighlightKey, {
    clear: true,
  } satisfies LinkEditorSelectionHighlightMeta);
  view.dispatch(tr);
}
