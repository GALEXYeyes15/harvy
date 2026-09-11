import { useEffect, useRef } from "react";
import { resolveWorkspaceImageSrc } from "../features/editor/imageAssets";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

type PdfConvertPreviewModalProps = {
  open: boolean;
  sourceName: string;
  sourcePath: string;
  workspaceRootPath: string | null;
  markdown: string | null;
  loading: boolean;
  error: string | null;
  submitting: boolean;
  onClose: () => void;
  onConvert: () => void;
  onRetry?: () => void;
};

export function PdfConvertPreviewModal({
  open,
  sourceName,
  sourcePath,
  workspaceRootPath,
  markdown,
  loading,
  error,
  submitting,
  onClose,
  onConvert,
  onRetry,
}: PdfConvertPreviewModalProps) {
  const convertButtonRef = useRef<HTMLButtonElement>(null);
  const fileSrc = sourcePath ? resolveWorkspaceImageSrc(workspaceRootPath, sourcePath) : "";
  const canConvert = markdown !== null && !loading && !error && !submitting;

  useEffect(() => {
    if (!open || loading || error || submitting) return;
    const frame = requestAnimationFrame(() => {
      convertButtonRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, loading, error, submitting]);

  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title="Convert to Markdown"
      titleId="harvy-pdf-convert-preview-title"
      subtitle={sourceName || undefined}
      backdropLabel="Dismiss convert preview"
      closeLabel="Close convert preview"
      panelSizeClassName="h-[min(88vh,calc(100vh-1.5rem))] w-full max-w-[min(900px,calc(100vw-1.5rem))]"
      autoFocusCloseButton={false}
      bodyClassName="flex min-h-0 flex-1 flex-col p-0"
    >
      <div className="min-h-0 min-w-0 flex-1 bg-white">
        {fileSrc ? (
          <iframe
            title={sourceName || "PDF"}
            src={fileSrc}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6">
            <p className="text-[14px] text-[#2a2622]">Could not preview this PDF.</p>
          </div>
        )}
      </div>

      {error ? (
        <div className="flex shrink-0 items-center gap-3 border-t border-[#6f6f6f]/35 px-6 py-3">
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink/90">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="h-9 shrink-0 rounded-lg px-3 text-[13px] font-medium text-muted/88 transition-colors hover:bg-ink/[0.05] hover:text-ink"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex shrink-0 items-center justify-end gap-3 px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="h-10 rounded-lg px-3 text-[13px] font-medium text-muted/88 transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-55"
        >
          Cancel
        </button>
        <button
          ref={convertButtonRef}
          type="button"
          onClick={onConvert}
          disabled={!canConvert}
          className="h-10 rounded-lg bg-white px-5 text-[13px] font-semibold text-ink shadow-sm transition-opacity hover:opacity-92 active:opacity-88 disabled:cursor-not-allowed disabled:opacity-45 dark:text-page"
        >
          {submitting ? "Converting…" : "Convert"}
        </button>
      </div>
    </CenteredOverlayModal>
  );
}
