import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { DecorationSet } from "@tiptap/pm/view";

export const proofreadDecorationsKey = new PluginKey<DecorationSet>("harvyProofreadDecorations");

/** When false (e.g. Outline mode), the plugin keeps an empty decoration set. */
export const proofreadDecorationsViewRef = {
  enabled: false,
};

type ProofreadMeta =
  | { set: DecorationSet }
  | { clear: true };

export const ProofreadDecorations = Extension.create({
  name: "proofreadDecorations",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: proofreadDecorationsKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, oldSet) {
            if (tr.docChanged) {
              return DecorationSet.empty;
            }
            if (!proofreadDecorationsViewRef.enabled) {
              return DecorationSet.empty;
            }
            const meta = tr.getMeta(proofreadDecorationsKey) as ProofreadMeta | boolean | undefined;
            if (meta === true) {
              return oldSet.map(tr.mapping, tr.doc);
            }
            if (meta && typeof meta === "object" && "clear" in meta && meta.clear) {
              return DecorationSet.empty;
            }
            if (meta && typeof meta === "object" && "set" in meta && meta.set) {
              return meta.set;
            }
            return oldSet.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return proofreadDecorationsKey.getState(state) ?? null;
          },
        },
      }),
    ];
  },
});

/** Replace AI proofread decorations (caller builds `DecorationSet` for the current doc). */
export function dispatchProofreadDecorations(
  view: import("@tiptap/pm/view").EditorView,
  set: DecorationSet,
): void {
  const tr = view.state.tr.setMeta(proofreadDecorationsKey, { set } satisfies ProofreadMeta);
  view.dispatch(tr);
}

export function clearProofreadDecorations(view: import("@tiptap/pm/view").EditorView): void {
  const tr = view.state.tr.setMeta(proofreadDecorationsKey, { clear: true } satisfies ProofreadMeta);
  view.dispatch(tr);
}
