import { useCallback, useEffect, useRef, useState } from "react";
import { documentTitlePaddingLeft } from "../features/chrome/tabNavChromeInsets";
import { TOOLS_SIDEBAR_WIDTH_PX } from "../features/workspace/workspaceSection";

type EditorDocumentHeaderProps = {
  /** Basename only (no extension) for display and rename. */
  documentTitleBase: string;
  documentDirty: boolean;
  workspaceSidebarOpen: boolean;
  /** When false (narrow “push” layout), workspace rail does not overlap chrome — no left margin. */
  overlayWorkspaceRail?: boolean;
  isWindowFullscreen?: boolean;
  readabilityPanelOpen: boolean;
  /** Hide document title row during distraction-free typing mode. */
  titleHidden?: boolean;
  /** When true, title is clickable for inline rename (commit may update disk or in-memory title only). */
  titleRenameEnabled: boolean;
  /** Persist new basename; return true on success. */
  onCommitDocumentTitle: (base: string) => Promise<boolean>;
  /** Live draft while renaming (`null` when not editing) — keeps Notes pop-out title in sync. */
  onTitleDraftChange?: (draftBase: string | null) => void;
};

const TITLE_EMPHASIS = "text-ink/88";
const TITLE_ROW_TYPOGRAPHY = "text-[11px] font-normal tracking-wide text-muted/58";

const LEADING_PAD_SYNC = "transition-[padding-left] duration-500 ease-in-out";

export function EditorDocumentHeader({
  documentTitleBase,
  documentDirty,
  workspaceSidebarOpen,
  overlayWorkspaceRail = true,
  isWindowFullscreen = false,
  readabilityPanelOpen,
  titleHidden = false,
  titleRenameEnabled,
  onCommitDocumentTitle,
  onTitleDraftChange,
}: EditorDocumentHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(documentTitleBase);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);

  const titlePaddingLeft = documentTitlePaddingLeft(workspaceSidebarOpen, isWindowFullscreen);

  const railShift = `transition-[margin-left] duration-500 ease-in-out ${
    overlayWorkspaceRail && workspaceSidebarOpen ? "ml-[260px]" : "ml-0"
  }`;

  const titleRowWidthStyle =
    overlayWorkspaceRail && readabilityPanelOpen
      ? ({ width: `calc(100% - ${TOOLS_SIDEBAR_WIDTH_PX}px)` } as const)
      : ({ width: "100%" } as const);

  useEffect(() => {
    setDraftTitle(documentTitleBase);
  }, [documentTitleBase]);

  useEffect(() => {
    onTitleDraftChange?.(isEditingTitle ? draftTitle : null);
  }, [isEditingTitle, draftTitle, onTitleDraftChange]);

  useEffect(() => {
    if (titleRenameEnabled || !isEditingTitle) return;
    skipBlurCommitRef.current = true;
    setIsEditingTitle(false);
    setDraftTitle(documentTitleBase);
  }, [titleRenameEnabled, isEditingTitle, documentTitleBase]);

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
    el.select();
  }, [isEditingTitle]);

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

  const startEditing = useCallback(() => {
    if (!titleRenameEnabled) {
      if (import.meta.env.DEV) {
        console.log("[HarvyTitle] startEditing blocked (titleRenameEnabled is false)");
      }
      return;
    }

    if (import.meta.env.DEV) {
      console.log("[HarvyTitle] title click → edit mode");
    }
    setDraftTitle(documentTitleBase);
    setIsEditingTitle(true);
  }, [documentTitleBase, titleRenameEnabled]);

  const titleRowClass = `inline-flex w-fit max-w-full min-h-[1.25rem] items-center gap-1.5 ${TITLE_ROW_TYPOGRAPHY}`;
  const titleFieldClass = `${TITLE_EMPHASIS} border-0 bg-transparent p-0 font-inherit text-inherit tracking-inherit shadow-none outline-none ring-0`;

  return (
    <div className="relative z-20 w-full min-w-0 shrink-0 bg-stage">
      <div className={`min-w-0 shrink-0 ${railShift}`}>
        <div
          className="min-w-0 shrink-0 transition-[width] duration-500 ease-in-out"
          style={titleRowWidthStyle}
        >
          <div
            className={`relative z-[2] flex w-full min-w-0 flex-row items-center pb-2 pt-1.5 pr-10 ${LEADING_PAD_SYNC} pointer-events-auto transition-[opacity,transform] duration-500 ease-in-out ${
              titleHidden ? "pointer-events-none -translate-y-2 opacity-0" : "translate-y-0 opacity-100"
            }`}
            style={{ paddingLeft: titlePaddingLeft }}
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
                    onChange={(e) => {
                      const next = e.target.value;
                      setDraftTitle(next);
                      onTitleDraftChange?.(next);
                    }}
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
    </div>
  );
}
