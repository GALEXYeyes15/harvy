import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

type FormatOutputModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
};

export function FormatOutputModal({ open, title, onClose }: FormatOutputModalProps) {
  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title={title}
      titleId="harvy-format-output-modal-title"
      backdropLabel="Close format editor"
      closeLabel="Close format editor"
      maxWidthClass="max-w-[min(720px,calc(100vw-3rem))]"
      bodyClassName="min-h-0 flex-1 overflow-y-auto px-6 py-6"
    >
      <p className="text-[14px] leading-relaxed text-muted/80">
        Format editor placeholder — generation and editing will live here.
      </p>
      <div className="mt-5 min-h-[220px] rounded-xl border border-line/25 bg-canvas/40 px-4 py-4 dark:bg-canvas/25">
        <p className="text-[13px] text-muted/55">Content preview area</p>
      </div>
    </CenteredOverlayModal>
  );
}
