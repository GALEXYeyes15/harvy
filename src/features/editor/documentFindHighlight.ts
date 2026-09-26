import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorView } from "@tiptap/pm/view";
import { findWorkspaceSearchPmRanges } from "./workspaceSearchHighlight";
import { activeFindIndex, type DocumentFindRange } from "./documentFind";

export type DocumentFindState = {
  query: string;
  activeIndex: number;
  ranges: DocumentFindRange[];
};

const EMPTY: DocumentFindState = { query: "", activeIndex: 0, ranges: [] };

type DocumentFindMeta = { clear: true } | { query: string; activeIndex: number };

export const documentFindHighlightKey = new PluginKey<DocumentFindState>("harvyDocumentFind");

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (index < 0 || index >= count) return 0;
  return index;
}

export const DocumentFindHighlight = Extension.create({
  name: "documentFindHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<DocumentFindState>({
        key: documentFindHighlightKey,
        state: {
          init: () => EMPTY,
          apply(tr, oldState) {
            const meta = tr.getMeta(documentFindHighlightKey) as DocumentFindMeta | undefined;
            if (meta && "clear" in meta && meta.clear) return EMPTY;

            let query = oldState.query;
            let activeIndex = oldState.activeIndex;
            const explicit = Boolean(meta && "query" in meta);
            if (meta && "query" in meta) {
              query = meta.query.trim();
              activeIndex = meta.activeIndex;
            }
            if (!query) return EMPTY;
            if (!explicit && !tr.docChanged) return oldState;

            const ranges = findWorkspaceSearchPmRanges(tr.doc, query);
            if (tr.docChanged && !explicit && oldState.ranges[oldState.activeIndex]) {
              const mapped = tr.mapping.map(oldState.ranges[oldState.activeIndex].from);
              activeIndex = activeFindIndex(ranges, mapped);
            }
            return { query, activeIndex: clampIndex(activeIndex, ranges.length), ranges };
          },
        },
        props: {
          decorations(state) {
            const current = documentFindHighlightKey.getState(state) ?? EMPTY;
            if (current.ranges.length === 0) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              current.ranges.map((range, index) =>
                Decoration.inline(range.from, range.to, {
                  class:
                    index === current.activeIndex
                      ? "harvy-document-find-hit harvy-document-find-hit--active"
                      : "harvy-document-find-hit",
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});

export function applyDocumentFind(
  view: EditorView,
  query: string,
  activeIndex: number,
): DocumentFindState {
  view.dispatch(
    view.state.tr.setMeta(documentFindHighlightKey, {
      query,
      activeIndex,
    } satisfies DocumentFindMeta),
  );
  return documentFindHighlightKey.getState(view.state) ?? EMPTY;
}

export function clearDocumentFind(view: EditorView | null | undefined): void {
  if (!view?.dom) return;
  const current = documentFindHighlightKey.getState(view.state) ?? EMPTY;
  if (!current.query && current.ranges.length === 0) return;
  view.dispatch(
    view.state.tr.setMeta(documentFindHighlightKey, { clear: true } satisfies DocumentFindMeta),
  );
}

export function scrollDocumentFindActive(view: EditorView): void {
  requestAnimationFrame(() => {
    const el = view.dom.querySelector(".harvy-document-find-hit--active");
    if (!(el instanceof HTMLElement)) return;
    const rect = el.getBoundingClientRect();
    const scroller = view.dom.closest(".overflow-y-auto");
    const bounds =
      scroller instanceof HTMLElement
        ? scroller.getBoundingClientRect()
        : { top: 0, bottom: window.innerHeight };
    const visible = rect.top >= bounds.top + 8 && rect.bottom <= bounds.bottom - 8;
    if (!visible) {
      el.scrollIntoView({ block: "center", inline: "nearest" });
    }
  });
}
