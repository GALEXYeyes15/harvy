import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ImagePlus, Subtitles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  buildUnsplashAttribution,
  type HarvyImageLoadAttrs,
  type HarvyImageSource,
} from "./harvyImageAttribution";
import { HarvyImageSourcePopover } from "./HarvyImageSourcePopover";
import { HarvyImageInsertionZone } from "./HarvyImageInsertionZone";
import {
  hasAdjacentTextBlockAfter,
  hasAdjacentTextBlockBefore,
} from "./harvyImageInsertion";
import { UnsplashAttributionCaption } from "./UnsplashAttributionCaption";
import type { HarvyImageStatus, HarvyImageWidth } from "./harvyImage";

function useHarvyImageAdjacentTextBlocks(editor: NodeViewProps["editor"], getPos: NodeViewProps["getPos"]) {
  const [adjacent, setAdjacent] = useState({ before: false, after: false });

  useEffect(() => {
    const sync = () => {
      const pos = getPos();
      if (typeof pos !== "number") return;
      const doc = editor.state.doc;
      setAdjacent({
        before: hasAdjacentTextBlockBefore(doc, pos),
        after: hasAdjacentTextBlockAfter(doc, pos),
      });
    };

    sync();
    editor.on("transaction", sync);
    return () => {
      editor.off("transaction", sync);
    };
  }, [editor, getPos]);

  return adjacent;
}

function normalizeLoadAttrs(selection: string | HarvyImageLoadAttrs): HarvyImageLoadAttrs {
  return typeof selection === "string" ? { src: selection } : selection;
}

export function HarvyImageNodeView({ node, updateAttributes, selected, editor, getPos, deleteNode }: NodeViewProps) {
  const src = (node.attrs.src as string | null) ?? null;
  const status = (node.attrs.status as HarvyImageStatus) ?? (src ? "loaded" : "placeholder");
  const caption = (node.attrs.caption as string) ?? "";
  const imageSource = (node.attrs.imageSource as HarvyImageSource) ?? null;
  const photographerName = (node.attrs.photographerName as string) ?? "";
  const photographerUrl = (node.attrs.photographerUrl as string) ?? "";
  const captionHtml = (node.attrs.captionHtml as string) ?? "";
  const unsplashUrl = (node.attrs.unsplashUrl as string) ?? "";
  const width = (node.attrs.width as HarvyImageWidth) ?? "full";
  const isPlaceholder = status === "placeholder" || !src;
  const [hovered, setHovered] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [replaceSourceOpen, setReplaceSourceOpen] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(caption);
  const [captionOpen, setCaptionOpen] = useState(
    () => Boolean(caption.trim()) && imageSource !== "unsplash",
  );
  const captionRef = useRef<HTMLInputElement>(null);
  const focusCaptionOnOpenRef = useRef(false);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const replaceBtnRef = useRef<HTMLButtonElement>(null);

  const generatedUnsplashCaption = useCallback(() => {
    if (imageSource !== "unsplash" || !photographerName.trim()) return "";
    return buildUnsplashAttribution({
      photographerName,
      photographerUrl,
      unsplashUrl,
    }).caption;
  }, [imageSource, photographerName, photographerUrl, unsplashUrl]);

  const hasUnsplashAttribution =
    imageSource === "unsplash" &&
    (Boolean(photographerName.trim()) || captionHtml.includes("</a>"));

  useEffect(() => {
    setCaptionDraft(caption);
    if (caption.trim() && imageSource !== "unsplash") {
      setCaptionOpen(true);
    }
  }, [caption, imageSource]);

  const resolveSrc = useCallback(
    (stored: string) => editor.storage.harvyImage?.resolveSrc?.(stored) ?? stored,
    [editor],
  );

  const displaySrc = src ? resolveSrc(src) : "";

  const commitCaption = useCallback(() => {
    const next = captionDraft.trim();
    const autoCaption = generatedUnsplashCaption();
    if (next === caption) return;

    if (imageSource === "unsplash" && autoCaption && next !== autoCaption) {
      updateAttributes({
        caption: next,
        alt: next,
        captionHtml: "",
        imageSource: null,
        photographerName: "",
        photographerUrl: "",
        unsplashUrl: "",
      });
      return;
    }

    updateAttributes({ caption: next, alt: next });
  }, [caption, captionDraft, generatedUnsplashCaption, imageSource, updateAttributes]);

  const applyImageSource = useCallback(
    (selection: string | HarvyImageLoadAttrs) => {
      const pos = getPos();
      if (typeof pos !== "number") return;
      const attrs = normalizeLoadAttrs(selection);
      editor.storage.harvyImage?.loadImageAt?.(pos, attrs);
      if (attrs.imageSource === "unsplash") {
        setCaptionOpen(false);
      }
      setSourceOpen(false);
      setReplaceSourceOpen(false);
    },
    [editor, getPos],
  );

  const openSourcePopover = useCallback(() => {
    setReplaceSourceOpen(false);
    setSourceOpen(true);
  }, []);

  const openReplacePopover = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    setSourceOpen(false);
    setReplaceSourceOpen(true);
  }, []);

  const toggleCaption = useCallback(() => {
    setCaptionOpen((open) => {
      if (open) {
        commitCaption();
        return false;
      }
      focusCaptionOnOpenRef.current = true;
      return true;
    });
  }, [commitCaption]);

  useLayoutEffect(() => {
    if (!captionOpen || !focusCaptionOnOpenRef.current) return;
    focusCaptionOnOpenRef.current = false;
    captionRef.current?.focus();
  }, [captionOpen]);

  const showChrome = !isPlaceholder && (selected || hovered);
  const adjacentText = useHarvyImageAdjacentTextBlocks(editor, getPos);

  if (isPlaceholder) {
    return (
      <NodeViewWrapper
        as="figure"
        className={`harvy-image-node harvy-image-node--picker ${selected ? "harvy-image-node--selected" : ""}`}
        data-image-block="true"
        data-harvy-image=""
        data-harvy-image-status="placeholder"
        data-width={width}
        data-drag-handle=""
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        contentEditable={false}
      >
        {!adjacentText.before ? <HarvyImageInsertionZone position="before-image" /> : null}
        <div className="harvy-image-node__content">
          <div className="harvy-image-node__frame harvy-image-node__frame--full">
            <button
              ref={pickerBtnRef}
              type="button"
              className="harvy-image-node__picker"
              onClick={openSourcePopover}
              aria-label="Add an image"
              aria-expanded={sourceOpen}
            >
              <span className="harvy-image-node__picker-icon" aria-hidden>
                <ImagePlus size={22} strokeWidth={1.6} />
              </span>
              <span className="harvy-image-node__picker-copy">
                <span className="harvy-image-node__picker-label">Add an image</span>
              </span>
            </button>
            {selected || hovered ? (
              <button
                type="button"
                className="harvy-image-node__picker-delete"
                aria-label="Remove image placeholder"
                title="Remove"
                onClick={(e) => {
                  e.stopPropagation();
                  setSourceOpen(false);
                  deleteNode();
                }}
              >
                <Trash2 size={15} strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        {!adjacentText.after ? <HarvyImageInsertionZone position="after-image" /> : null}

        {sourceOpen && pickerBtnRef.current
          ? (
              <HarvyImageSourcePopover
                mode="insert"
                anchorEl={pickerBtnRef.current}
                onClose={() => setSourceOpen(false)}
                onSelectImage={applyImageSource}
                onUploadFile={() => editor.storage.harvyImage?.pickLocalImage?.() ?? Promise.resolve(null)}
              />
            )
          : null}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="figure"
      className={`harvy-image-node ${selected ? "harvy-image-node--selected" : ""}`}
      data-image-block="true"
      data-harvy-image=""
      data-harvy-image-status="loaded"
      data-width={width}
      data-drag-handle=""
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      contentEditable={false}
    >
      {!adjacentText.before ? <HarvyImageInsertionZone position="before-image" /> : null}
      <div className="harvy-image-node__content">
        <div className={`harvy-image-node__frame harvy-image-node__frame--${width}`}>
          {showChrome ? (
            <div className="harvy-image-node__toolbar" contentEditable={false}>
              <button
                type="button"
                className={`harvy-image-node__toolbar-btn ${
                  captionOpen ? "harvy-image-node__toolbar-btn--active" : ""
                }`}
                aria-label="Caption"
                title="Caption"
                aria-pressed={captionOpen}
                onClick={toggleCaption}
              >
                <Subtitles size={15} strokeWidth={1.75} aria-hidden />
              </button>
              <button
                ref={replaceBtnRef}
                type="button"
                className="harvy-image-node__toolbar-btn"
                aria-label="Replace image"
                title="Replace image"
                aria-expanded={replaceSourceOpen}
                onClick={openReplacePopover}
              >
                <ImagePlus size={15} strokeWidth={1.75} aria-hidden />
              </button>
              <button
                type="button"
                className="harvy-image-node__toolbar-btn harvy-image-node__toolbar-btn--danger"
                aria-label="Delete image"
                title="Delete image"
                onClick={deleteNode}
              >
                <Trash2 size={15} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          ) : null}

          {displaySrc ? (
            <img
              src={displaySrc}
              alt={caption || "Document image"}
              className="harvy-image-node__img"
              draggable={false}
            />
          ) : (
            <div className="harvy-image-node__missing">Image unavailable</div>
          )}
        </div>

        {hasUnsplashAttribution && photographerName.trim() ? (
          <UnsplashAttributionCaption
            photographerName={photographerName}
            photographerUrl={photographerUrl}
            unsplashUrl={unsplashUrl}
          />
        ) : null}

        {captionOpen ? (
          <input
            ref={captionRef}
            type="text"
            className={`harvy-image-node__caption ${
              hasUnsplashAttribution ? "harvy-image-node__caption--edit" : ""
            }`}
            placeholder="Add a caption (optional)"
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            onBlur={commitCaption}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitCaption();
                captionRef.current?.blur();
                const pos = getPos();
                if (typeof pos === "number") {
                  editor.commands.focusParagraphAfterHarvyImage(pos);
                }
              }
            }}
          />
        ) : null}
      </div>
      {!adjacentText.after ? <HarvyImageInsertionZone position="after-image" /> : null}

      {replaceSourceOpen && replaceBtnRef.current
        ? (
            <HarvyImageSourcePopover
              mode="replace"
              anchorEl={replaceBtnRef.current}
              onClose={() => setReplaceSourceOpen(false)}
              onSelectImage={applyImageSource}
              onUploadFile={() => editor.storage.harvyImage?.pickLocalImage?.() ?? Promise.resolve(null)}
            />
          )
        : null}
    </NodeViewWrapper>
  );
}
