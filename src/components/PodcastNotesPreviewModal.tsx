import { useMemo } from "react";
import { markdownToEditorHtml } from "../features/editor/documentMarkdown";
import { ensurePodcastNotesBullets } from "../features/aiCheck/podcastNotesMarkdown";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

type PodcastNotesPreviewModalProps = {
  open: boolean;
  markdown: string | null;
  generating: boolean;
  error: string | null;
  onClose: () => void;
  onExport: () => void;
  onPrint?: () => void;
  onRetry?: () => void;
};

const OPTION_LABEL =
  "text-[11px] font-medium tracking-wide text-muted/70";

const OPTION_FIELD =
  "flex h-11 w-full min-w-0 items-center rounded-[10px] border border-[#6f6f6f] bg-ink/[0.04] px-3.5 text-[14px] font-medium text-ink/92 dark:bg-ink/[0.07]";

const OPTION_BUTTON =
  "flex h-11 w-full min-w-0 items-center justify-center rounded-[10px] border border-[#6f6f6f] bg-ink/[0.04] px-3.5 text-[14px] font-medium text-ink/92 transition-colors hover:bg-ink/[0.07] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-ink/[0.07] dark:hover:bg-ink/[0.1]";

export function PodcastNotesPreviewModal({
  open,
  markdown,
  generating,
  error,
  onClose,
  onExport,
  onPrint,
  onRetry,
}: PodcastNotesPreviewModalProps) {
  const previewHtml = useMemo(() => {
    if (!markdown?.trim()) return "";
    return markdownToEditorHtml(ensurePodcastNotesBullets(markdown));
  }, [markdown]);

  const canExport = Boolean(markdown?.trim()) && !generating && !error;

  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title="Podcast Notes"
      titleId="harvy-podcast-notes-preview-title"
      backdropLabel="Dismiss podcast notes preview"
      closeLabel="Close podcast notes preview"
      panelSizeClassName="h-[min(88vh,calc(100vh-1.5rem))] w-full max-w-[min(1180px,calc(100vw-1.5rem))]"
      autoFocusCloseButton={false}
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
    >
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-ink/[0.06] px-10 py-8 dark:bg-black/25">
          <div className="mx-auto w-full max-w-[46rem]">
            <article className="harvy-podcast-notes-sheet min-h-[36rem] rounded-[2px] bg-white px-14 py-16 shadow-[0_18px_48px_-28px_rgba(28,25,23,0.55)]">
              {generating ? (
                <div
                  className="space-y-5"
                  aria-busy="true"
                  aria-live="polite"
                  aria-label="Preparing podcast notes"
                >
                  <div className="h-8 w-[62%] animate-pulse rounded bg-black/[0.08]" />
                  <div className="h-5 w-[38%] animate-pulse rounded bg-black/[0.07]" />
                  <div className="space-y-2.5 pt-3">
                    <div className="h-3.5 w-full animate-pulse rounded bg-black/[0.06]" />
                    <div className="h-3.5 w-[94%] animate-pulse rounded bg-black/[0.06]" />
                    <div className="h-3.5 w-[88%] animate-pulse rounded bg-black/[0.06]" />
                    <div className="h-3.5 w-[72%] animate-pulse rounded bg-black/[0.06]" />
                  </div>
                  <div className="h-5 w-[44%] animate-pulse rounded bg-black/[0.07] pt-6" />
                  <div className="space-y-2.5 pt-3">
                    <div className="h-3.5 w-[90%] animate-pulse rounded bg-black/[0.06]" />
                    <div className="h-3.5 w-full animate-pulse rounded bg-black/[0.06]" />
                    <div className="h-3.5 w-[64%] animate-pulse rounded bg-black/[0.06]" />
                  </div>
                </div>
              ) : error ? (
                <div className="flex min-h-[16rem] flex-col items-start justify-center gap-4">
                  <p className="text-[15px] leading-relaxed text-[#2a2622]">{error}</p>
                  {onRetry ? (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="h-10 rounded-lg px-3 text-[13px] font-medium text-[#6e6860] transition-colors hover:bg-black/[0.05] hover:text-[#2a2622]"
                    >
                      Try again
                    </button>
                  ) : null}
                </div>
              ) : previewHtml ? (
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : null}
            </article>
          </div>
        </div>

        <aside className="flex w-[min(22.5rem,38%)] shrink-0 flex-col border-l border-[#6f6f6f]/45 px-5 py-5">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <p className={OPTION_LABEL}>Format</p>
              <div className={OPTION_FIELD}>PDF</div>
            </div>
            {onPrint ? (
              <div className="flex flex-col gap-1.5">
                <p className={OPTION_LABEL}>Print</p>
                <button
                  type="button"
                  onClick={onPrint}
                  disabled={!canExport}
                  className={OPTION_BUTTON}
                >
                  Print
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-auto flex items-center justify-end gap-3 pt-8">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg px-3 text-[13px] font-medium text-muted/88 transition-colors hover:bg-ink/[0.05] hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onExport}
              disabled={!canExport}
              className="h-10 rounded-lg bg-white px-5 text-[13px] font-semibold text-ink shadow-sm transition-opacity hover:opacity-92 active:opacity-88 disabled:cursor-not-allowed disabled:opacity-45 dark:text-page"
            >
              Export PDF
            </button>
          </div>
        </aside>
      </div>
    </CenteredOverlayModal>
  );
}
