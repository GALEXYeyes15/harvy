import type { CollectItem } from "../features/collect/collectItems";
import { collectItemTypeLabel, formatCollectDateCreated } from "../features/collect/collectItems";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

type CollectItemModalProps = {
  open: boolean;
  item: CollectItem | null;
  onClose: () => void;
};

export function CollectItemModal({ open, item, onClose }: CollectItemModalProps) {
  if (!item) return null;

  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title={item.preview}
      titleId="harvy-collect-item-title"
      backdropLabel="Close collected item"
      closeLabel="Close collected item"
      maxWidthClass="max-w-[min(720px,calc(100vw-3rem))]"
      bodyClassName="min-h-0 flex-1 overflow-y-auto px-6 py-5"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted/70 dark:text-white/50">
          <span>{collectItemTypeLabel(item.type)}</span>
          <span aria-hidden>·</span>
          <span>{formatCollectDateCreated(item.dateCreated)}</span>
        </div>
        {item.body ? (
          <p className="text-[14px] leading-relaxed text-ink/90 dark:text-white/88">{item.body}</p>
        ) : (
          <p className="text-[14px] leading-relaxed text-muted/65 dark:text-white/45">No additional notes.</p>
        )}
      </div>
    </CenteredOverlayModal>
  );
}
