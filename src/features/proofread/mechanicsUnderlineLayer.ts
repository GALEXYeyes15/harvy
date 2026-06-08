import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { MechanicsUnderlineRange } from "./mechanicsUnderlineRanges";

export type MechanicsUnderlineLayerState = {
  ranges: MechanicsUnderlineRange[];
};

export const mechanicsUnderlineLayerKey = new PluginKey<MechanicsUnderlineLayerState>(
  "harvyMechanicsUnderlineLayer",
);

/** Back-compat alias used by AppShell / EditorCanvas. */
export const proofreadDecorationsKey = mechanicsUnderlineLayerKey;

/** When false, overlay underlines are hidden (analysis/ranges stay in plugin state). */
export const proofreadDecorationsViewRef = {
  visible: false,
};

type MechanicsUnderlineMeta =
  | { set: MechanicsUnderlineRange[] }
  | { clear: true }
  | true;

const UNDERLINE_HEIGHT_PX = 3;
const UNDERLINE_OFFSET_PX = 2;

type LocalRect = {
  left: number;
  top: number;
  width: number;
};

type ViewportRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el;
  while (node) {
    const { overflowY, overflowX } = window.getComputedStyle(node);
    if (
      overflowY === "auto" ||
      overflowY === "scroll" ||
      overflowY === "overlay" ||
      overflowX === "auto" ||
      overflowX === "scroll"
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Viewport rectangles for a document range (single line via coordsAtPos, multi-line via DOM Range). */
function viewportRectsForRange(view: EditorView, from: number, to: number): ViewportRect[] {
  if (from >= to) return [];

  try {
    const start = view.coordsAtPos(from, 1);
    const end = view.coordsAtPos(to, -1);
    if (Math.abs(start.bottom - end.bottom) < 6) {
      return [
        {
          left: start.left,
          right: end.right,
          top: start.top,
          bottom: Math.max(start.bottom, end.bottom),
        },
      ];
    }
  } catch {
    /* fall through to DOM Range */
  }

  try {
    const start = view.domAtPos(from);
    const end = view.domAtPos(to);
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);

    const lineHeight = parseFloat(window.getComputedStyle(view.dom).lineHeight) || 28;
    const maxRectHeight = lineHeight * 1.35;

    return Array.from(range.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0 && rect.height <= maxRectHeight)
      .map((rect) => ({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      }));
  } catch {
    return [];
  }
}

/** Convert a viewport text rect into editor-local coordinates for the overlay layer. */
function toEditorLocalRect(view: EditorView, rect: ViewportRect): LocalRect {
  const editorEl = view.dom;
  const editorRect = editorEl.getBoundingClientRect();

  return {
    left: rect.left - editorRect.left + editorEl.scrollLeft,
    top: rect.bottom - editorRect.top + editorEl.scrollTop - UNDERLINE_OFFSET_PX,
    width: rect.right - rect.left,
  };
}

function alignLayerToEditor(layerEl: HTMLDivElement, editorEl: HTMLElement): void {
  layerEl.style.left = `${editorEl.offsetLeft}px`;
  layerEl.style.top = `${editorEl.offsetTop}px`;
  layerEl.style.width = `${editorEl.offsetWidth}px`;
  layerEl.style.height = `${editorEl.offsetHeight}px`;
}

class MechanicsUnderlineLayerView {
  private readonly layerEl: HTMLDivElement;
  private readonly scrollParent: HTMLElement | null;
  private readonly onLayoutChange: () => void;
  private resizeObserver: ResizeObserver | null = null;
  private view: EditorView;

  constructor(view: EditorView) {
    this.view = view;
    this.layerEl = document.createElement("div");
    this.layerEl.className = "harvy-mechanics-underline-layer";
    this.layerEl.setAttribute("aria-hidden", "true");

    const editorEl = view.dom;
    const mount = editorEl.parentElement;
    if (mount) {
      if (window.getComputedStyle(mount).position === "static") {
        mount.style.position = "relative";
      }
      mount.appendChild(this.layerEl);
      alignLayerToEditor(this.layerEl, editorEl);
    }

    this.onLayoutChange = () => {
      requestAnimationFrame(() => {
        alignLayerToEditor(this.layerEl, this.view.dom);
        this.paint(this.view);
      });
    };

    this.scrollParent = findScrollParent(editorEl);
    this.scrollParent?.addEventListener("scroll", this.onLayoutChange, { passive: true });
    window.addEventListener("resize", this.onLayoutChange);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.onLayoutChange);
      this.resizeObserver.observe(editorEl);
      if (mount) this.resizeObserver.observe(mount);
    }

    if (document.fonts?.ready) {
      void document.fonts.ready.then(this.onLayoutChange);
    }

    this.paint(view);
  }

  update(view: EditorView): void {
    this.view = view;
    alignLayerToEditor(this.layerEl, view.dom);
    this.paint(view);
  }

  destroy(): void {
    this.scrollParent?.removeEventListener("scroll", this.onLayoutChange);
    window.removeEventListener("resize", this.onLayoutChange);
    this.resizeObserver?.disconnect();
    this.layerEl.remove();
  }

  private syncLayerVisibility(): void {
    this.layerEl.classList.toggle(
      "harvy-mechanics-underline-layer--hidden",
      !proofreadDecorationsViewRef.visible,
    );
  }

  private paint(view: EditorView): void {
    const state = mechanicsUnderlineLayerKey.getState(view.state);
    const editorEl = view.dom;
    this.syncLayerVisibility();

    if (!proofreadDecorationsViewRef.visible) {
      return;
    }

    this.layerEl.replaceChildren();

    if (!state?.ranges.length) {
      return;
    }

    alignLayerToEditor(this.layerEl, editorEl);

    for (const range of state.ranges) {
      if (range.from >= range.to) continue;

      const viewportRects = viewportRectsForRange(view, range.from, range.to);

      for (const viewportRect of viewportRects) {
        const local = toEditorLocalRect(view, viewportRect);

        const el = document.createElement("div");
        el.className = `harvy-mechanics-underline harvy-mechanics-underline--${range.type}`;
        el.dataset.harvyProofreadType = range.type;
        if (range.suggestion) {
          el.dataset.harvyProofreadSuggestion = range.suggestion;
        }
        el.style.left = `${local.left}px`;
        el.style.top = `${local.top}px`;
        el.style.width = `${Math.max(0, local.width)}px`;
        el.style.height = `${UNDERLINE_HEIGHT_PX}px`;
        this.layerEl.appendChild(el);
      }
    }
  }
}

export const MechanicsUnderlineLayer = Extension.create({
  name: "mechanicsUnderlineLayer",

  addProseMirrorPlugins() {
    return [
      new Plugin<MechanicsUnderlineLayerState>({
        key: mechanicsUnderlineLayerKey,
        state: {
          init: () => ({ ranges: [] }),
          apply(tr, oldState) {
            const meta = tr.getMeta(mechanicsUnderlineLayerKey) as MechanicsUnderlineMeta | undefined;

            if (meta && typeof meta === "object" && "clear" in meta && meta.clear) {
              return { ranges: [] };
            }
            if (meta && typeof meta === "object" && "set" in meta && meta.set) {
              return { ranges: meta.set };
            }
            if (tr.docChanged && oldState.ranges.length > 0) {
              const ranges = oldState.ranges
                .map((range) => ({
                  ...range,
                  from: tr.mapping.map(range.from),
                  to: tr.mapping.map(range.to, -1),
                }))
                .filter((range) => range.from < range.to);
              return { ranges };
            }
            if (meta === true) {
              return oldState;
            }
            return oldState;
          },
        },
        view(view) {
          return new MechanicsUnderlineLayerView(view);
        },
      }),
    ];
  },
});

/** Back-compat export name used in EditorCanvas. */
export const ProofreadDecorations = MechanicsUnderlineLayer;

export function dispatchProofreadDecorations(
  view: EditorView,
  ranges: MechanicsUnderlineRange[],
): void {
  const tr = view.state.tr.setMeta(mechanicsUnderlineLayerKey, { set: ranges } satisfies MechanicsUnderlineMeta);
  view.dispatch(tr);
}

export function clearProofreadDecorations(view: EditorView): void {
  const tr = view.state.tr.setMeta(mechanicsUnderlineLayerKey, { clear: true } satisfies MechanicsUnderlineMeta);
  view.dispatch(tr);
}

/** Show or hide mechanics underlines without clearing stored ranges/issues. */
export function setMechanicsUnderlinesVisible(view: EditorView, visible: boolean): void {
  proofreadDecorationsViewRef.visible = visible;
  const tr = view.state.tr.setMeta(mechanicsUnderlineLayerKey, true);
  view.dispatch(tr);
}
