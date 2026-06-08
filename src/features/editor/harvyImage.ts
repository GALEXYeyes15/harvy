import { Node, mergeAttributes } from "@tiptap/core";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import { NodeSelection, Plugin } from "@tiptap/pm/state";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { HarvyImageNodeView } from "./HarvyImageNodeView";
import {
  buildUnsplashAttribution,
  type HarvyImageLoadAttrs,
  type HarvyImageSource,
  isManuallyEditedUnsplashCaption,
  resolveUnsplashWebsiteUrl,
  sanitizeUnsplashCaptionHtml,
  UNSPLASH_WEBSITE_URL,
} from "./harvyImageAttribution";
import { handleHarvyImageAdjacentPointerDown, isHarvyImageInteractiveTarget } from "./harvyImageAdjacentFocus";
import {
  focusParagraphAfterHarvyImageAtPos,
  focusParagraphAfterHarvyImageInTr,
  focusParagraphBeforeHarvyImageAtPos,
  insertHarvyImageBlocksAtSelection,
} from "./harvyImageInsertion";

export type HarvyImageWidth = "small" | "medium" | "full";
export type HarvyImageStatus = "placeholder" | "loaded";

export type HarvyImageStorage = {
  resolveSrc: (storedSrc: string) => string;
  pickLocalImage: () => Promise<string | null>;
  loadImageAt: (pos: number, attrs: HarvyImageLoadAttrs) => void;
};

function readCaptionHtmlFromFigure(element: HTMLElement): string {
  const imageSource = element.getAttribute("data-image-source");
  const photographerName = element.getAttribute("data-photographer-name")?.trim();
  if (imageSource === "unsplash" && photographerName) {
    return buildUnsplashAttribution({
      photographerName,
      photographerUrl: element.getAttribute("data-photographer-url") ?? "",
    }).captionHtml;
  }

  const stored = element.getAttribute("data-caption-html")?.trim();
  if (stored) return sanitizeUnsplashCaptionHtml(stored);
  const cap = element.querySelector("figcaption");
  if (cap?.querySelector("a")) return sanitizeUnsplashCaptionHtml(cap.innerHTML.trim());
  return "";
}

function normalizeLegacyUnsplashNodeAttrs(
  attrs: Record<string, unknown>,
): Record<string, unknown> | null {
  if (attrs.imageSource !== "unsplash") return null;
  const unsplashUrl = String(attrs.unsplashUrl ?? "");
  const captionHtml = String(attrs.captionHtml ?? "");
  const hasLegacyLink = unsplashUrl.includes("utm_") || captionHtml.includes("utm_source=harvy");
  if (!hasLegacyLink && unsplashUrl === UNSPLASH_WEBSITE_URL) return null;

  const photographerName = String(attrs.photographerName ?? "").trim();
  if (!photographerName) return null;

  const attribution = buildUnsplashAttribution({
    photographerName,
    photographerUrl: String(attrs.photographerUrl ?? ""),
  });

  return {
    ...attrs,
    unsplashUrl: UNSPLASH_WEBSITE_URL,
    captionHtml: attribution.captionHtml,
  };
}

function readFigureAttrs(el: HTMLElement) {
  const img = el.querySelector("img");
  const src = img?.getAttribute("src") ?? null;
  return {
    src,
    status: parseImageStatus(el, src),
    alt: img?.getAttribute("alt") ?? "",
    caption: el.querySelector("figcaption")?.textContent?.trim() ?? el.getAttribute("data-caption") ?? "",
    captionHtml: readCaptionHtmlFromFigure(el),
    width: parseImageWidth(el),
    imageSource: (el.getAttribute("data-image-source") as HarvyImageSource) || null,
    photographerName: el.getAttribute("data-photographer-name") ?? "",
    photographerUrl: el.getAttribute("data-photographer-url") ?? "",
    unsplashUrl: resolveUnsplashWebsiteUrl(el.getAttribute("data-unsplash-url")),
  };
}

function renderFigcaption(attrs: Record<string, unknown>): DOMOutputSpec | null {
  const imageSource = attrs.imageSource as HarvyImageSource;
  const photographerName = (attrs.photographerName as string | undefined)?.trim();
  if (imageSource === "unsplash" && photographerName) {
    const photographerUrl = (attrs.photographerUrl as string | undefined)?.trim() || "#";
    const unsplashLink = resolveUnsplashWebsiteUrl(attrs.unsplashUrl as string | undefined);
    return [
      "figcaption",
      {},
      "Photo by ",
      [
        "a",
        {
          href: photographerUrl,
          class: "harvy-editor-link underline decoration-from-font underline-offset-[0.12em]",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        photographerName,
      ],
      " on ",
      [
        "a",
        {
          href: unsplashLink,
          class: "harvy-editor-link underline decoration-from-font underline-offset-[0.12em]",
          target: "_blank",
          rel: "noopener noreferrer",
        },
        "Unsplash",
      ],
    ];
  }

  const caption = (attrs.caption as string | undefined)?.trim();
  if (!caption) return null;
  return ["figcaption", {}, caption];
}

function mergeLoadedImageAttrs(
  current: Record<string, unknown>,
  attrs: HarvyImageLoadAttrs,
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...current,
    src: attrs.src,
    status: "loaded",
  };

  if (attrs.imageSource === "unsplash") {
    const attribution = buildUnsplashAttribution({
      photographerName: attrs.photographerName ?? "",
      photographerUrl: attrs.photographerUrl ?? "",
    });
    return {
      ...next,
      imageSource: "unsplash",
      photographerName: attrs.photographerName ?? "",
      photographerUrl: attrs.photographerUrl ?? "",
      unsplashUrl: UNSPLASH_WEBSITE_URL,
      caption: attrs.caption ?? attribution.caption,
      captionHtml: attribution.captionHtml,
      alt: attrs.caption ?? attribution.caption,
      ...(attrs.width !== undefined ? { width: attrs.width } : {}),
    };
  }

  const wasUnsplash = current.imageSource === "unsplash";
  const keepManualCaption =
    wasUnsplash &&
    isManuallyEditedUnsplashCaption({
      imageSource: current.imageSource as HarvyImageSource,
      caption: current.caption as string | undefined,
      photographerName: current.photographerName as string | undefined,
      photographerUrl: current.photographerUrl as string | undefined,
      unsplashUrl: current.unsplashUrl as string | undefined,
    });

  return {
    ...next,
    imageSource: null,
    photographerName: "",
    photographerUrl: "",
    unsplashUrl: "",
    captionHtml: "",
    ...(attrs.caption !== undefined
      ? { caption: attrs.caption, alt: attrs.caption }
      : wasUnsplash && !keepManualCaption
        ? { caption: "", alt: "" }
        : keepManualCaption
          ? { caption: current.caption, alt: current.alt ?? current.caption }
          : {}),
    ...(attrs.width !== undefined ? { width: attrs.width } : {}),
  };
}

function parseImageWidth(element: HTMLElement): HarvyImageWidth {
  const raw =
    element.getAttribute("data-width") ??
    (element.tagName === "FIGURE" ? element.getAttribute("data-harvy-image-width") : null);
  if (raw === "small" || raw === "medium" || raw === "full") return raw;
  return "full";
}

function parseImageStatus(element: HTMLElement, src: string | null): HarvyImageStatus {
  const raw = element.getAttribute("data-harvy-image-status");
  if (raw === "placeholder") return "placeholder";
  if (raw === "loaded") return "loaded";
  if (element.classList.contains("harvy-image-block--placeholder")) return "placeholder";
  return src ? "loaded" : "placeholder";
}

declare module "@tiptap/core" {
  interface Storage {
    harvyImage: HarvyImageStorage;
  }

  interface Commands<ReturnType> {
    harvyImage: {
      insertHarvyImagePlaceholder: () => ReturnType;
      insertHarvyImage: (attrs: {
        src: string;
        caption?: string;
        width?: HarvyImageWidth;
      }) => ReturnType;
      loadHarvyImageAt: (pos: number, attrs: HarvyImageLoadAttrs) => ReturnType;
      replaceHarvyImageAt: (pos: number, attrs: { src: string }) => ReturnType;
      focusParagraphAfterHarvyImage: (pos: number) => ReturnType;
      focusParagraphBeforeHarvyImage: (pos: number) => ReturnType;
    };
  }
}

export const HarvyImage = Node.create({
  name: "harvyImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addStorage() {
    return {
      resolveSrc: (storedSrc: string) => storedSrc,
      pickLocalImage: async () => null,
      loadImageAt: (_pos: number, _attrs: HarvyImageLoadAttrs) => {},
    } satisfies HarvyImageStorage;
  },

  addAttributes() {
    return {
      src: {
        default: null as string | null,
        parseHTML: (element) => {
          const img =
            element.tagName === "IMG"
              ? element
              : (element.querySelector("img") as HTMLImageElement | null);
          return img?.getAttribute("src") ?? null;
        },
      },
      status: {
        default: "loaded" as HarvyImageStatus,
        parseHTML: (element) => {
          const el = element as HTMLElement;
          const img = el.tagName === "IMG" ? el : el.querySelector("img");
          const src = img?.getAttribute("src") ?? null;
          return parseImageStatus(el, src);
        },
        renderHTML: (attributes) => ({
          "data-harvy-image-status": attributes.status as string,
        }),
      },
      alt: {
        default: "",
        parseHTML: (element) => {
          const img =
            element.tagName === "IMG"
              ? element
              : (element.querySelector("img") as HTMLImageElement | null);
          return img?.getAttribute("alt") ?? "";
        },
      },
      caption: {
        default: "",
        parseHTML: (element) => {
          if (element.tagName === "FIGURE") {
            const cap = element.querySelector("figcaption");
            return cap?.textContent?.trim() ?? element.getAttribute("data-caption") ?? "";
          }
          return element.getAttribute("data-caption") ?? "";
        },
        renderHTML: (attributes) => {
          if (!attributes.caption) return {};
          return { "data-caption": attributes.caption as string };
        },
      },
      captionHtml: {
        default: "",
        parseHTML: (element) => readCaptionHtmlFromFigure(element as HTMLElement),
        renderHTML: (attributes) => {
          if (attributes.imageSource === "unsplash" && attributes.photographerName) {
            return {
              "data-caption-html": buildUnsplashAttribution({
                photographerName: attributes.photographerName as string,
                photographerUrl: (attributes.photographerUrl as string) ?? "",
              }).captionHtml,
            };
          }
          if (!attributes.captionHtml) return {};
          return {
            "data-caption-html": sanitizeUnsplashCaptionHtml(attributes.captionHtml as string),
          };
        },
      },
      imageSource: {
        default: null as HarvyImageSource,
        parseHTML: (element) => {
          const raw = (element as HTMLElement).getAttribute("data-image-source");
          return raw === "unsplash" ? "unsplash" : null;
        },
        renderHTML: (attributes) => {
          if (attributes.imageSource !== "unsplash") return {};
          return { "data-image-source": "unsplash" };
        },
      },
      photographerName: {
        default: "",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-photographer-name") ?? "",
        renderHTML: (attributes) => {
          if (!attributes.photographerName) return {};
          return { "data-photographer-name": attributes.photographerName as string };
        },
      },
      photographerUrl: {
        default: "",
        parseHTML: (element) => (element as HTMLElement).getAttribute("data-photographer-url") ?? "",
        renderHTML: (attributes) => {
          if (!attributes.photographerUrl) return {};
          return { "data-photographer-url": attributes.photographerUrl as string };
        },
      },
      unsplashUrl: {
        default: "",
        parseHTML: (element) =>
          resolveUnsplashWebsiteUrl((element as HTMLElement).getAttribute("data-unsplash-url")),
        renderHTML: (attributes) => {
          if (attributes.imageSource !== "unsplash" && !attributes.unsplashUrl) return {};
          if (attributes.imageSource === "unsplash") {
            return { "data-unsplash-url": UNSPLASH_WEBSITE_URL };
          }
          return { "data-unsplash-url": UNSPLASH_WEBSITE_URL };
        },
      },
      width: {
        default: "full" as HarvyImageWidth,
        parseHTML: (element) => parseImageWidth(element as HTMLElement),
        renderHTML: (attributes) => ({
          "data-width": attributes.width as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-harvy-image]",
        getAttrs: (element) => readFigureAttrs(element as HTMLElement),
      },
      {
        tag: "figure.harvy-image-block",
        getAttrs: (element) => readFigureAttrs(element as HTMLElement),
      },
      {
        tag: "img[src]",
        getAttrs: (element) => {
          const el = element as HTMLImageElement;
          if (el.closest("figure[data-harvy-image], figure.harvy-image-block")) return false;
          return {
            src: el.getAttribute("src"),
            status: "loaded" as HarvyImageStatus,
            alt: el.getAttribute("alt") ?? "",
            caption: "",
            width: "full",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, width, src, alt, status, captionHtml: _captionHtml, ...rest } = HTMLAttributes;
    const figcaption = (caption as string | undefined)?.trim();
    const imageStatus = (status as HarvyImageStatus | undefined) ?? (src ? "loaded" : "placeholder");
    const isPlaceholder = imageStatus === "placeholder" || !src;
    const figcaptionNode = renderFigcaption(HTMLAttributes);

    const figureAttrs = mergeAttributes(rest, {
      "data-harvy-image": "",
      class: isPlaceholder ? "harvy-image-block harvy-image-block--placeholder" : "harvy-image-block",
      "data-width": width ?? "full",
      "data-harvy-image-status": isPlaceholder ? "placeholder" : "loaded",
      ...(figcaption ? { "data-caption": figcaption } : {}),
    });

    if (isPlaceholder) {
      return ["figure", figureAttrs];
    }

    return [
      "figure",
      figureAttrs,
      ["img", { src, alt: alt ?? "", draggable: "false" }],
      ...(figcaptionNode ? [figcaptionNode] : []),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HarvyImageNodeView);
  },

  onCreate() {
    const { editor } = this;
    const { state } = editor;
    let tr = state.tr;
    let changed = false;

    state.doc.descendants((node, pos) => {
      if (node.type.name !== "harvyImage") return;
      const nextAttrs = normalizeLegacyUnsplashNodeAttrs(node.attrs);
      if (!nextAttrs) return;
      tr = tr.setNodeMarkup(pos, undefined, nextAttrs);
      changed = true;
    });

    if (changed) editor.view.dispatch(tr);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            mousedown: (view, event) =>
              handleHarvyImageAdjacentPointerDown(view, event as MouseEvent),
          },
          handleClick: (view, _pos, event) => {
            if (!(event.target instanceof Element)) return false;
            if (isHarvyImageInteractiveTarget(event.target)) return false;
            const figure = event.target.closest("[data-harvy-image]");
            if (!figure || !view.dom.contains(figure)) return false;
            return true;
          },
        },
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          let tr: import("@tiptap/pm/state").Transaction | null = null;

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "harvyImage") return;
            const nextAttrs = normalizeLegacyUnsplashNodeAttrs(node.attrs);
            if (!nextAttrs) return;
            tr = (tr ?? newState.tr).setNodeMarkup(pos, undefined, nextAttrs);
          });

          return tr;
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        if (selection instanceof NodeSelection && selection.node.type.name === this.name) {
          return editor.commands.focusParagraphAfterHarvyImage(selection.from);
        }
        return false;
      },
      ArrowDown: ({ editor }) => {
        const { selection } = editor.state;
        if (selection instanceof NodeSelection && selection.node.type.name === this.name) {
          return editor.commands.focusParagraphAfterHarvyImage(selection.from);
        }
        return false;
      },
    };
  },

  addCommands() {
    return {
      insertHarvyImagePlaceholder:
        () =>
        ({ editor }) =>
          insertHarvyImageBlocksAtSelection(editor, {
            src: null,
            status: "placeholder",
            caption: "",
            width: "full",
            alt: "",
          }),
      insertHarvyImage:
        (attrs: { src: string; caption?: string; width?: HarvyImageWidth }) =>
        ({ editor }) => {
          if (!attrs.src) return false;
          return insertHarvyImageBlocksAtSelection(editor, {
            src: attrs.src,
            status: "loaded",
            caption: attrs.caption ?? "",
            width: attrs.width ?? "full",
            alt: attrs.caption ?? "",
          });
        },
      loadHarvyImageAt:
        (pos: number, attrs: HarvyImageLoadAttrs) =>
        ({ tr, dispatch, state }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          if (!attrs.src) return false;
          if (!dispatch) return true;
          let nextTr = tr.setNodeMarkup(pos, undefined, mergeLoadedImageAttrs(node.attrs, attrs));
          nextTr = focusParagraphAfterHarvyImageInTr(nextTr, pos, state.schema);
          dispatch(nextTr);
          return true;
        },
      replaceHarvyImageAt:
        (pos: number, attrs: { src: string }) =>
        ({ commands }) =>
          commands.loadHarvyImageAt(pos, attrs),
      focusParagraphAfterHarvyImage:
        (pos: number) =>
        ({ editor }) =>
          focusParagraphAfterHarvyImageAtPos(editor, pos),
      focusParagraphBeforeHarvyImage:
        (pos: number) =>
        ({ editor }) =>
          focusParagraphBeforeHarvyImageAtPos(editor, pos),
    };
  },
});
