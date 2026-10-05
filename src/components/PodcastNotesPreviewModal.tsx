import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { editorHtmlToMarkdown, markdownToEditorHtml } from "../features/editor/documentMarkdown";
import { ensurePodcastNotesBullets } from "../features/aiCheck/podcastNotesMarkdown";
import {
  layoutPresentationNotesPages,
  type NotesPageBreak,
} from "../features/aiCheck/presentationNotesPages";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

type PodcastNotesPreviewModalProps = {
  open: boolean;
  markdown: string | null;
  generating: boolean;
  error: string | null;
  onClose: () => void;
  onExport: () => void;
  onShare?: (event: MouseEvent<HTMLButtonElement>) => void;
  onRetry?: () => void;
  onMarkdownChange?: (markdown: string) => void;
};

const ACTION_BUTTON =
  "h-10 rounded-lg bg-ink px-5 text-[13px] font-semibold text-canvas shadow-sm transition-opacity hover:opacity-92 active:opacity-88 disabled:cursor-not-allowed disabled:opacity-45";

const EMPTY_PAGES: { pageCount: number; breaks: NotesPageBreak[] } = { pageCount: 0, breaks: [] };

function samePageBreaks(a: NotesPageBreak[], b: NotesPageBreak[]) {
  return (
    a.length === b.length &&
    a.every((item, index) => item.page === b[index]?.page && Math.abs(item.top - b[index].top) < 0.5)
  );
}

export function PodcastNotesPreviewModal({
  open,
  markdown,
  generating,
  error,
  onClose,
  onExport,
  onShare,
  onRetry,
  onMarkdownChange,
}: PodcastNotesPreviewModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  /** Markdown last written into the sheet, so typing does not reset the caret. */
  const appliedMarkdownRef = useRef<string | null>(null);
  const [pages, setPages] = useState(EMPTY_PAGES);
  const syncPagesRef = useRef(() => {});

  syncPagesRef.current = () => {
    const sheet = sheetRef.current;
    const column = columnRef.current;
    if (!open || !sheet || !column || generating || error) {
      setPages((prev) => (prev.pageCount === 0 && prev.breaks.length === 0 ? prev : EMPTY_PAGES));
      return;
    }
    const next = layoutPresentationNotesPages(sheet, column);
    setPages((prev) =>
      prev.pageCount === next.pageCount && samePageBreaks(prev.breaks, next.breaks) ? prev : next,
    );
  };

  useLayoutEffect(() => {
    if (!open) {
      appliedMarkdownRef.current = null;
      setPages(EMPTY_PAGES);
      return;
    }
    const sheet = sheetRef.current;
    if (!sheet || generating || error) {
      setPages(EMPTY_PAGES);
      return;
    }
    const normalized = markdown?.trim() ? ensurePodcastNotesBullets(markdown) : "";
    if (appliedMarkdownRef.current !== normalized) {
      sheet.innerHTML = normalized ? markdownToEditorHtml(normalized) : "";
      appliedMarkdownRef.current = normalized;
    }
    syncPagesRef.current();
  }, [open, markdown, generating, error]);

  useLayoutEffect(() => {
    const column = columnRef.current;
    if (!open || !column) return;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncPagesRef.current());
    observer.observe(column);
    return () => observer.disconnect();
  }, [open, generating, error]);

  const publishSheetMarkdown = () => {
    const sheet = sheetRef.current;
    if (!sheet || !onMarkdownChange) return;
    const next = ensurePodcastNotesBullets(editorHtmlToMarkdown(sheet.innerHTML));
    appliedMarkdownRef.current = next;
    onMarkdownChange(next);
    syncPagesRef.current();
  };

  const canExport = Boolean(markdown?.trim()) && !generating && !error;

  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title="Presentation Notes"
      titleId="harvy-podcast-notes-preview-title"
      backdropLabel="Dismiss presentation notes preview"
      closeLabel="Close presentation notes preview"
      panelClassName="harvy-presentation-notes-modal"
      panelSizeClassName="h-[min(88vh,calc(100vh-1.5rem))] w-full max-w-[min(920px,calc(100vw-1.5rem))]"
      autoFocusCloseButton={false}
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-14 pb-24 pt-10">
            <div ref={columnRef} className="relative mx-auto w-full max-w-[40rem]">
              <article className="harvy-podcast-notes-sheet min-h-full">
              {generating ? (
                <div
                  className="space-y-5"
                  aria-busy="true"
                  aria-live="polite"
                  aria-label="Preparing presentation notes"
                >
                  <div className="h-8 w-[62%] animate-pulse rounded bg-ink/10" />
                  <div className="h-5 w-[38%] animate-pulse rounded bg-ink/[0.08]" />
                  <div className="space-y-2.5 pt-3">
                    <div className="h-3.5 w-full animate-pulse rounded bg-ink/[0.06]" />
                    <div className="h-3.5 w-[94%] animate-pulse rounded bg-ink/[0.06]" />
                    <div className="h-3.5 w-[88%] animate-pulse rounded bg-ink/[0.06]" />
                    <div className="h-3.5 w-[72%] animate-pulse rounded bg-ink/[0.06]" />
                  </div>
                  <div className="h-5 w-[44%] animate-pulse rounded bg-ink/[0.08] pt-6" />
                  <div className="space-y-2.5 pt-3">
                    <div className="h-3.5 w-[90%] animate-pulse rounded bg-ink/[0.06]" />
                    <div className="h-3.5 w-full animate-pulse rounded bg-ink/[0.06]" />
                    <div className="h-3.5 w-[64%] animate-pulse rounded bg-ink/[0.06]" />
                  </div>
                </div>
              ) : error ? (
                <div className="flex min-h-[16rem] flex-col items-start justify-center gap-4">
                  <p className="text-[15px] leading-relaxed text-ink">{error}</p>
                  {onRetry ? (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="h-10 rounded-lg px-3 text-[13px] font-medium text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
                    >
                      Try again
                    </button>
                  ) : null}
                </div>
              ) : (
                <div
                  ref={sheetRef}
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Edit presentation notes"
                  spellCheck={false}
                  className="outline-none caret-ink"
                  onInput={publishSheetMarkdown}
                  onPaste={(event) => {
                    event.preventDefault();
                    const text = event.clipboardData.getData("text/plain");
                    document.execCommand("insertText", false, text);
                    publishSheetMarkdown();
                  }}
                />
              )}
              </article>
              {pages.breaks.map((pageBreak) => (
                <div
                  key={pageBreak.page}
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 flex h-[3.25rem] items-center"
                  style={{ top: pageBreak.top }}
                >
                  <div
                    className="h-px flex-1"
                    style={{ backgroundColor: "color-mix(in oklab, var(--color-ink) 22%, transparent)" }}
                  />
                  <span className="px-3 text-[11px] tabular-nums tracking-wide text-muted">
                    Page {pageBreak.page}
                  </span>
                  <div
                    className="h-px flex-1"
                    style={{ backgroundColor: "color-mix(in oklab, var(--color-ink) 22%, transparent)" }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-8 pb-6 pt-14"
            style={{
              backgroundImage:
                "linear-gradient(to top, var(--harvy-notes-surface) 0%, var(--harvy-notes-surface) 38%, transparent 100%)",
            }}
          >
            <p className="pb-2.5 text-[12px] text-muted">
              {pages.pageCount > 0
                ? `${pages.pageCount} ${pages.pageCount === 1 ? "page" : "pages"}`
                : ""}
            </p>
            <div className="pointer-events-auto flex gap-3">
            <button
              type="button"
              onClick={onShare}
              disabled={!canExport || !onShare}
              className={ACTION_BUTTON}
            >
              Share
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={!canExport}
              className={ACTION_BUTTON}
            >
              Save
            </button>
            </div>
          </div>
        </div>
    </CenteredOverlayModal>
  );
}
