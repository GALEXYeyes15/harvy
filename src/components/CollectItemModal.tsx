import {
  COLLECT_FORMAT_OPTIONS,
  COLLECT_TYPE_OPTIONS,
  collectItemFormatLabel,
  formatCollectDateCreated,
  type CollectItem,
} from "../features/collect/collectItems";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

type CollectItemModalProps = {
  open: boolean;
  item: CollectItem | null;
  onClose: () => void;
  onUpdateItem: (itemId: string, patch: Partial<CollectItem>) => void;
};

export function CollectItemModal({
  open,
  item,
  onClose,
  onUpdateItem,
}: CollectItemModalProps) {
  if (!item) return null;

  const title = item.preview.trim() || "Untitled";

  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title={title}
      titleId="harvy-collect-item-title"
      backdropLabel="Close collected item"
      closeLabel="Close collected item"
      maxWidthClass="max-w-[min(720px,calc(100vw-3rem))]"
      bodyClassName="min-h-0 flex-1 overflow-y-auto px-6 py-5"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted/70 dark:text-white/50">
          <span>{collectItemFormatLabel(item.format)}</span>
          <span aria-hidden>·</span>
          <span>{item.type}</span>
          <span aria-hidden>·</span>
          <span>{formatCollectDateCreated(item.dateCreated)}</span>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="harvy-collect-item-preview"
            className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60"
          >
            Preview
          </label>
          <textarea
            id="harvy-collect-item-preview"
            value={item.preview}
            onChange={(event) => onUpdateItem(item.id, { preview: event.target.value })}
            placeholder="Untitled"
            rows={4}
            className="w-full resize-y rounded-md border-0 bg-canvas/45 px-3 py-2.5 text-[14px] leading-relaxed text-ink placeholder:text-muted/65 focus:outline-none focus:ring-0 dark:bg-canvas/35 dark:text-white/88"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="harvy-collect-item-format"
              className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60"
            >
              Format
            </label>
            <select
              id="harvy-collect-item-format"
              value={item.format}
              onChange={(event) => onUpdateItem(item.id, { format: event.target.value })}
              className="w-full rounded-md border-0 bg-canvas/45 px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-0 dark:bg-canvas/35 dark:text-white/88"
            >
              {!(COLLECT_FORMAT_OPTIONS as readonly string[]).includes(item.format) ? (
                <option value={item.format}>{item.format}</option>
              ) : null}
              {COLLECT_FORMAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="harvy-collect-item-type"
              className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/60"
            >
              Type
            </label>
            <select
              id="harvy-collect-item-type"
              value={item.type}
              onChange={(event) =>
                onUpdateItem(item.id, { type: event.target.value as CollectItem["type"] })
              }
              className="w-full rounded-md border-0 bg-canvas/45 px-3 py-2 text-[13px] text-ink focus:outline-none focus:ring-0 dark:bg-canvas/35 dark:text-white/88"
            >
              {COLLECT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </CenteredOverlayModal>
  );
}
