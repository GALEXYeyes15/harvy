import { PanelRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChromeSidebarToggleButton } from "./ChromeSidebarToggleButton";

type EditorDocumentHeaderProps = {
  /** Basename only (no extension) for display and rename. */
  documentTitleBase: string;
  documentDirty: boolean;
  workspaceSidebarOpen: boolean;
  /** When false (narrow “push” layout), workspace rail does not overlap chrome — no left margin. */
  overlayWorkspaceRail?: boolean;
  reserveWorkspaceToggleSlot: boolean;
  readabilityPanelOpen: boolean;
  /** Hide document title row during distraction-free typing mode. */
  titleHidden?: boolean;
  /** Hide sidebar toggle chrome during distraction-free typing mode. */
  chromeButtonsHidden?: boolean;
  onToggleReadabilityPanel: () => void;
  /** When true, title is clickable for inline rename (commit may update disk or in-memory title only). */
  titleRenameEnabled: boolean;
  /** Persist new basename; return true on success. */
  onCommitDocumentTitle: (base: string) => Promise<boolean>;
};

const TITLE_EMPHASIS = "text-ink/88";
const TITLE_ROW_TYPOGRAPHY = "text-[11px] font-normal tracking-wide text-muted/58";

const LEADING_PAD_SYNC = "transition-[padding-left] duration-500 ease-in-out";

function parsePx(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function measureTextWidthWithSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacingPx: number,
): number {
  if (!text) return 0;
  return ctx.measureText(text).width + letterSpacingPx * Math.max(0, text.length - 1);
}

export function EditorDocumentHeader({
  documentTitleBase,
  documentDirty,
  workspaceSidebarOpen,
  overlayWorkspaceRail = true,
  reserveWorkspaceToggleSlot,
  readabilityPanelOpen,
  titleHidden = false,
  chromeButtonsHidden,
  onToggleReadabilityPanel,
  titleRenameEnabled,
  onCommitDocumentTitle,
}: EditorDocumentHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(documentTitleBase);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);
  const pendingCaretIndexRef = useRef<number | null>(null);
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const chromeLeftPadding = workspaceSidebarOpen
    ? "pl-[calc(var(--harvy-traffic-light-inset,0px)+0.625rem)]"
    : reserveWorkspaceToggleSlot
      ? "pl-[calc(var(--harvy-traffic-light-inset,0px)+2.5rem)]"
      : "pl-[calc(var(--harvy-traffic-light-inset,0px)+0.625rem)]";

  const railShift = `transition-[margin-left] duration-500 ease-in-out ${
    overlayWorkspaceRail && workspaceSidebarOpen ? "ml-[260px]" : "ml-0"
  }`;

  const titleRowVisibleWidth =
    overlayWorkspaceRail && readabilityPanelOpen ? "w-[calc(100%-300px)]" : "w-full";

  useEffect(() => {
    setDraftTitle(documentTitleBase);
  }, [documentTitleBase]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[HarvyTitle] header props", {
      titleRenameEnabled,
      documentTitleBase,
      isEditingTitle,
      renderMode: titleRenameEnabled ? (isEditingTitle ? "input" : "button") : "span",
    });
  }, [titleRenameEnabled, documentTitleBase, isEditingTitle]);

  useEffect(() => {
    if (!isEditingTitle) return;
    const el = inputRef.current;
    if (!el) return;
    if (import.meta.env.DEV) {
      console.log("[HarvyTitle] input mount/focus", { documentTitleBase });
    }
    el.focus();
    const fallbackIndex = draftTitle.length;
    const nextIndex = pendingCaretIndexRef.current ?? fallbackIndex;
    const safeIndex = Math.max(0, Math.min(nextIndex, draftTitle.length));
    el.setSelectionRange(safeIndex, safeIndex);
    pendingCaretIndexRef.current = null;
  }, [isEditingTitle, documentTitleBase, draftTitle]);

  const exitViewMode = useCallback(() => {
    setIsEditingTitle(false);
    setDraftTitle(documentTitleBase);
  }, [documentTitleBase]);

  const commitAndClose = useCallback(async () => {
    const raw = draftTitle.trim();
    if (raw === documentTitleBase) {
      setIsEditingTitle(false);
      setDraftTitle(documentTitleBase);
      return;
    }
    const ok = await onCommitDocumentTitle(raw);
    if (ok) {
      setIsEditingTitle(false);
    } else {
      setDraftTitle(documentTitleBase);
    }
  }, [draftTitle, documentTitleBase, onCommitDocumentTitle]);

  const onTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        skipBlurCommitRef.current = true;
        void commitAndClose();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        skipBlurCommitRef.current = true;
        exitViewMode();
      }
    },
    [commitAndClose, exitViewMode],
  );

  const onTitleBlur = useCallback(() => {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }
    void commitAndClose();
  }, [commitAndClose]);

  const startEditing = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!titleRenameEnabled) {
        if (import.meta.env.DEV) {
          console.log("[HarvyTitle] startEditing blocked (titleRenameEnabled is false)");
        }
        return;
      }

      let caretIndex = documentTitleBase.length;
      const text = documentTitleBase;
      const button = e.currentTarget;
      const width = button.clientWidth;

      if (width > 0 && text.length > 0) {
        const rect = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);
        const clickX = Math.max(0, Math.min(e.clientX - rect.left, width));
        const letterSpacingPx = style.letterSpacing === "normal" ? 0 : parsePx(style.letterSpacing);

        const canvas = measureCanvasRef.current ?? document.createElement("canvas");
        measureCanvasRef.current = canvas;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          // Use the rendered button font so click→caret placement feels native.
          ctx.font = style.font;
          let low = 0;
          let high = text.length;
          while (low < high) {
            const mid = Math.floor((low + high) / 2);
            const midWidth = measureTextWidthWithSpacing(ctx, text.slice(0, mid), letterSpacingPx);
            if (midWidth < clickX) low = mid + 1;
            else high = mid;
          }

          const rightIdx = low;
          const leftIdx = Math.max(0, rightIdx - 1);
          const leftWidth = measureTextWidthWithSpacing(ctx, text.slice(0, leftIdx), letterSpacingPx);
          const rightWidth = measureTextWidthWithSpacing(ctx, text.slice(0, rightIdx), letterSpacingPx);
          caretIndex =
            Math.abs(clickX - leftWidth) <= Math.abs(rightWidth - clickX) ? leftIdx : rightIdx;
        } else {
          // Fallback if text metrics are unavailable: place caret by click ratio.
          caretIndex = Math.round((clickX / width) * text.length);
        }
      }

      pendingCaretIndexRef.current = caretIndex;
      if (import.meta.env.DEV) {
        console.log("[HarvyTitle] title click → edit mode", { caretIndex });
      }
      setDraftTitle(documentTitleBase);
      setIsEditingTitle(true);
    },
    [documentTitleBase, titleRenameEnabled],
  );

  const titleRowClass = `inline-flex w-fit max-w-full min-h-[1.25rem] items-center gap-1.5 ${TITLE_ROW_TYPOGRAPHY}`;
  const titleFieldClass = `${TITLE_EMPHASIS} border-0 bg-transparent p-0 font-inherit text-inherit tracking-inherit shadow-none outline-none ring-0`;

  return (
    <div className="relative z-20 w-full min-w-0 shrink-0 bg-stage">
      <div className={`min-w-0 shrink-0 ${railShift}`}>
        <div
          className={`min-w-0 shrink-0 transition-[width] duration-500 ease-in-out ${titleRowVisibleWidth}`}
        >
          <div
            className={`relative z-[2] flex w-full min-w-0 flex-row items-center pb-2 pt-1.5 pr-10 ${LEADING_PAD_SYNC} ${chromeLeftPadding} pointer-events-auto transition-[opacity,transform] duration-500 ease-in-out ${
              titleHidden ? "pointer-events-none -translate-y-2 opacity-0" : "translate-y-0 opacity-100"
            }`}
          >
            <div className={titleRowClass}>
              {isEditingTitle ? (
                <span
                  className={`relative inline-block w-fit max-w-full min-h-[1.25rem] ${TITLE_EMPHASIS}`}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none invisible block whitespace-pre select-none"
                  >
                    {draftTitle || "\u00A0"}
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={onTitleKeyDown}
                    onBlur={onTitleBlur}
                    aria-label="Document name"
                    className={`${titleFieldClass} absolute inset-y-0 left-0 m-0 h-full min-w-0 focus:border-0 focus:ring-0`}
                    style={{ width: "100%" }}
                  />
                </span>
              ) : titleRenameEnabled ? (
                <button
                  type="button"
                  onClick={startEditing}
                  className={`${titleFieldClass} min-h-[1.25rem] min-w-0 max-w-full cursor-text truncate text-left transition-colors duration-200 hover:text-ink`}
                  title={documentTitleBase}
                  aria-label={`Rename document, currently ${documentTitleBase}`}
                >
                  {documentTitleBase}
                </button>
              ) : (
                <span
                  className={`${titleFieldClass} min-h-[1.25rem] min-w-0 max-w-full truncate`}
                  title={documentTitleBase}
                  aria-live="polite"
                >
                  {documentTitleBase}
                </span>
              )}
              {documentDirty ? <span className="shrink-0 italic text-muted/52">(Unsaved)</span> : null}
            </div>
          </div>
        </div>
      </div>

      <div
        className={`pointer-events-none absolute inset-y-0 right-0 z-30 flex items-center pr-2 transition-opacity duration-500 ease-in-out ${
          chromeButtonsHidden ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="pointer-events-auto shrink-0">
          <ChromeSidebarToggleButton
            icon={PanelRight}
            open={readabilityPanelOpen}
            onClick={onToggleReadabilityPanel}
            ariaLabelOpen="Hide tools panel"
            ariaLabelClosed="Show tools panel"
          />
        </div>
      </div>
    </div>
  );
}
