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

/** Set when overlay mounting/painting fails — keeps the editor usable without underlines. */
let mechanicsOverlayDisabled = false;

type MechanicsUnderlineMeta =
  | { set: MechanicsUnderlineRange[] }
  | { clear: true }
  | true;

const UNDERLINE_HEIGHT_PX = 3;
const UNDERLINE_OFFSET_PX = 2;
const LAYER_CLASS = "harvy-mechanics-underline-layer";

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

function logOverlayError(scope: string, error: unknown): void {
  mechanicsOverlayDisabled = true;
  proofreadDecorationsViewRef.visible = false;
  if (import.meta.env.DEV) {
    console.error(`[HarvyMechanics] overlay ${scope}`, error);
  }
}

function isDomEnvironmentReady(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function isViewDomReady(view: EditorView | null | undefined): view is EditorView {
  if (!view?.dom) return false;
  if (!isDomEnvironmentReady()) return false;
  return document.body.contains(view.dom);
}

function isValidPmRange(view: EditorView, from: number, to: number): boolean {
  if (from < 0 || to <= from) return false;
  const size = view.state.doc.content.size;
  return from <= size && to <= size;
}

function isScrollableOverflow(value: string): boolean {
  return value === "auto" || value === "scroll" || value === "overlay";
}

function findScrollableAncestors(el: HTMLElement): HTMLElement[] {
  const ancestors: HTMLElement[] = [];
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY, overflowX } = window.getComputedStyle(node);
    if (isScrollableOverflow(overflowY) || isScrollableOverflow(overflowX)) {
      ancestors.push(node);
    }
    node = node.parentElement;
  }
  return ancestors;
}

/** Viewport rectangles for a document range (single line via coordsAtPos, multi-line via DOM Range). */
function viewportRectsForRange(view: EditorView, from: number, to: number): ViewportRect[] {
  if (!isValidPmRange(view, from, to)) return [];

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

/** Map viewport coords into ProseMirror-root document space. */
function toEditorContentRect(view: EditorView, rect: ViewportRect): LocalRect | null {
  const root = view.dom;
  if (!root) return null;

  const rootRect = root.getBoundingClientRect();
  const width = rect.right - rect.left;
  if (!Number.isFinite(width) || width <= 0) return null;

  return {
    left: rect.left - rootRect.left,
    top: rect.bottom - rootRect.top - UNDERLINE_OFFSET_PX,
    width,
  };
}

type PluginViewLike = {
  update: (view: EditorView) => void;
  destroy: () => void;
};

function createNoopPluginView(): PluginViewLike {
  return {
    update: () => {},
    destroy: () => {},
  };
}

class MechanicsUnderlineLayerView implements PluginViewLike {
  private readonly layerEl: HTMLDivElement | null;
  private readonly scrollCleanups: Array<() => void> = [];
  private readonly onLayoutChange: () => void;
  private readonly onScroll: () => void;
  private resizeObserver: ResizeObserver | null = null;
  private view: EditorView;
  private mounted = false;
  private painting = false;

  constructor(view: EditorView) {
    this.view = view;
    this.layerEl = isDomEnvironmentReady() ? document.createElement("div") : null;

    if (this.layerEl) {
      this.layerEl.className = LAYER_CLASS;
      this.layerEl.setAttribute("aria-hidden", "true");
      this.layerEl.setAttribute("contenteditable", "false");
    }

    this.onScroll = () => {
      this.safePaint(this.view);
    };

    this.onLayoutChange = () => {
      requestAnimationFrame(() => {
        this.safeSyncAndPaint(this.view);
      });
    };

    if (isDomEnvironmentReady()) {
      window.addEventListener("resize", this.onLayoutChange);

      if (this.layerEl && isViewDomReady(view)) {
        try {
          if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(this.onLayoutChange);
            this.resizeObserver.observe(view.dom);
          }

          for (const scrollEl of findScrollableAncestors(view.dom)) {
            scrollEl.addEventListener("scroll", this.onScroll, { passive: true });
            this.scrollCleanups.push(() => scrollEl.removeEventListener("scroll", this.onScroll));
          }

          if (document.fonts?.ready) {
            void document.fonts.ready.then(this.onLayoutChange);
          }
        } catch (error) {
          logOverlayError("init listeners", error);
        }
      }

      requestAnimationFrame(() => {
        this.safeSyncAndPaint(this.view);
      });
    }
  }

  update(view: EditorView): void {
    this.view = view;
    if (mechanicsOverlayDisabled) return;
    this.safeSyncAndPaint(view);
  }

  destroy(): void {
    if (isDomEnvironmentReady()) {
      window.removeEventListener("resize", this.onLayoutChange);
    }
    for (const cleanup of this.scrollCleanups) cleanup();
    this.resizeObserver?.disconnect();
    this.layerEl?.remove();
  }

  private safeSyncAndPaint(view: EditorView): void {
    if (mechanicsOverlayDisabled) return;
    try {
      if (!this.mountLayer(view)) return;
      this.safePaint(view);
    } catch (error) {
      logOverlayError("sync", error);
    }
  }

  private safePaint(view: EditorView): void {
    if (mechanicsOverlayDisabled || this.painting) return;
    this.painting = true;
    try {
      if (!this.layerEl || !isViewDomReady(view) || !this.mounted) return;
      this.paint(view);
    } catch (error) {
      logOverlayError("paint", error);
    } finally {
      this.painting = false;
    }
  }

  /**
   * Mount as sibling of ProseMirror (never inside view.dom — foreign nodes break PM DOM sync).
   */
  private mountLayer(view: EditorView): boolean {
    if (!this.layerEl || mechanicsOverlayDisabled) return false;
    if (!isViewDomReady(view)) return false;

    const editorEl = view.dom;
    const mount = editorEl.parentElement;
    if (!mount) return false;

    try {
      mount.classList.add("harvy-mechanics-underline-mount");
      if (window.getComputedStyle(mount).position === "static") {
        mount.style.position = "relative";
      }

      if (!mount.contains(this.layerEl)) {
        mount.insertBefore(this.layerEl, editorEl);
      } else if (this.layerEl.nextSibling !== editorEl) {
        mount.insertBefore(this.layerEl, editorEl);
      }

      this.syncLayerSize(editorEl);
      this.mounted = true;
      return true;
    } catch (error) {
      logOverlayError("mount", error);
      return false;
    }
  }

  private syncLayerSize(editorEl: HTMLElement): void {
    if (!this.layerEl) return;
    this.layerEl.style.top = `${editorEl.offsetTop}px`;
    this.layerEl.style.left = `${editorEl.offsetLeft}px`;
    this.layerEl.style.width = `${editorEl.offsetWidth}px`;
    this.layerEl.style.height = `${editorEl.offsetHeight}px`;
  }

  private syncLayerVisibility(): void {
    if (!this.layerEl) return;
    this.layerEl.classList.toggle(
      "harvy-mechanics-underline-layer--hidden",
      !proofreadDecorationsViewRef.visible || mechanicsOverlayDisabled,
    );
  }

  private paint(view: EditorView): void {
    if (!this.layerEl || !isViewDomReady(view)) return;

    const state = mechanicsUnderlineLayerKey.getState(view.state);
    this.syncLayerVisibility();

    if (!proofreadDecorationsViewRef.visible || mechanicsOverlayDisabled) {
      return;
    }

    this.syncLayerSize(view.dom);
    this.layerEl.replaceChildren();

    if (!state?.ranges.length) {
      return;
    }

    for (const range of state.ranges) {
      if (!isValidPmRange(view, range.from, range.to)) continue;

      let viewportRects: ViewportRect[] = [];
      try {
        viewportRects = viewportRectsForRange(view, range.from, range.to);
      } catch {
        continue;
      }

      for (const viewportRect of viewportRects) {
        const local = toEditorContentRect(view, viewportRect);
        if (!local) continue;
        if (!Number.isFinite(local.left) || !Number.isFinite(local.top)) continue;

        const el = document.createElement("div");
        el.className = `harvy-mechanics-underline harvy-mechanics-underline--${range.type}`;
        el.dataset.harvyProofreadType = range.type;
        if (range.suggestion) {
          el.dataset.harvyProofreadSuggestion = range.suggestion;
        }
        el.style.left = `${local.left}px`;
        el.style.top = `${local.top}px`;
        el.style.width = `${Math.max(0, local.width)}px`;
        el.style.height = `${range.type === "ai" ? 2 : UNDERLINE_HEIGHT_PX}px`;
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
          if (!isDomEnvironmentReady()) return createNoopPluginView();
          try {
            return new MechanicsUnderlineLayerView(view);
          } catch (error) {
            logOverlayError("construct", error);
            return createNoopPluginView();
          }
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
  if (mechanicsOverlayDisabled || !isViewDomReady(view)) return;
  try {
    const tr = view.state.tr.setMeta(mechanicsUnderlineLayerKey, { set: ranges } satisfies MechanicsUnderlineMeta);
    view.dispatch(tr);
  } catch (error) {
    logOverlayError("dispatch", error);
  }
}

export function clearProofreadDecorations(view: EditorView): void {
  if (!view?.dom) return;
  try {
    const tr = view.state.tr.setMeta(mechanicsUnderlineLayerKey, { clear: true } satisfies MechanicsUnderlineMeta);
    view.dispatch(tr);
  } catch (error) {
    logOverlayError("clear", error);
  }
}

/** Show or hide mechanics underlines without clearing stored ranges/issues. */
export function setMechanicsUnderlinesVisible(view: EditorView | null | undefined, visible: boolean): void {
  if (mechanicsOverlayDisabled || !isViewDomReady(view)) {
    proofreadDecorationsViewRef.visible = false;
    return;
  }
  try {
    proofreadDecorationsViewRef.visible = visible;
    const tr = view.state.tr.setMeta(mechanicsUnderlineLayerKey, true);
    view.dispatch(tr);
  } catch (error) {
    logOverlayError("visibility", error);
  }
}
