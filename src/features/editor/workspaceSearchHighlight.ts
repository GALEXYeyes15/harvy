import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";
import { proofreadPlainTextAndPositions } from "../proofread/proofreadPlainMap";
import { findCaseInsensitiveRanges } from "../workspace/markdownSearch";

export type WorkspaceSearchHighlightRange = {
  from: number;
  to: number;
};

type WorkspaceSearchHighlightMeta =
  | { set: WorkspaceSearchHighlightRange[] }
  | { clear: true };

export const workspaceSearchHighlightKey = new PluginKey<WorkspaceSearchHighlightRange[]>(
  "harvyWorkspaceSearchHighlight",
);

export function findWorkspaceSearchPmRanges(
  doc: PMNode,
  query: string,
): WorkspaceSearchHighlightRange[] {
  const needle = query.trim();
  if (!needle) return [];
  const { text, charToPmPos } = proofreadPlainTextAndPositions(doc);
  const out: WorkspaceSearchHighlightRange[] = [];
  for (const span of findCaseInsensitiveRanges(text, needle)) {
    let from = -1;
    let to = -1;
    let ok = true;
    for (let i = span.start; i < span.end; i++) {
      const pos = charToPmPos[i];
      if (pos == null || pos < 0) {
        ok = false;
        break;
      }
      if (from < 0) from = pos;
      to = pos + 1;
    }
    if (ok && from >= 0 && to > from) out.push({ from, to });
  }
  return out;
}

export const WorkspaceSearchHighlight = Extension.create({
  name: "workspaceSearchHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<WorkspaceSearchHighlightRange[]>({
        key: workspaceSearchHighlightKey,
        state: {
          init: () => [],
          apply(tr, oldState) {
            const meta = tr.getMeta(workspaceSearchHighlightKey) as
              | WorkspaceSearchHighlightMeta
              | undefined;
            if (meta && "clear" in meta && meta.clear) return [];
            if (meta && "set" in meta) return meta.set;
            if (tr.docChanged) return [];
            return oldState;
          },
        },
        props: {
          decorations(state) {
            const ranges = workspaceSearchHighlightKey.getState(state) ?? [];
            if (ranges.length === 0) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              ranges.map((range) =>
                Decoration.inline(range.from, range.to, {
                  class: "harvy-workspace-search-hit",
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});

export function applyWorkspaceSearchHighlight(editor: Editor, query: string): boolean {
  const view = editor.view;
  if (!view?.dom) return false;
  const ranges = findWorkspaceSearchPmRanges(view.state.doc, query);
  if (ranges.length === 0) return false;
  view.dispatch(
    view.state.tr.setMeta(workspaceSearchHighlightKey, {
      set: ranges,
    } satisfies WorkspaceSearchHighlightMeta),
  );
  requestAnimationFrame(() => {
    view.dom.querySelector(".harvy-workspace-search-hit")?.scrollIntoView({
      block: "center",
      inline: "nearest",
    });
  });
  return true;
}

export function clearWorkspaceSearchHighlight(view: EditorView | null | undefined): void {
  if (!view?.dom) return;
  const current = workspaceSearchHighlightKey.getState(view.state) ?? [];
  if (current.length === 0) return;
  view.dispatch(
    view.state.tr.setMeta(workspaceSearchHighlightKey, {
      clear: true,
    } satisfies WorkspaceSearchHighlightMeta),
  );
}

export function workspaceSearchHighlightIsActive(view: EditorView | null | undefined): boolean {
  if (!view?.dom) return false;
  return (workspaceSearchHighlightKey.getState(view.state) ?? []).length > 0;
}
