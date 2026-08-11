import { ChevronDown, FileText, Type as TypeIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatCollectDateCreated, type CollectItem } from "../features/collect/collectItems";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

type CollectItemModalProps = {
  open: boolean;
  item: CollectItem | null;
  onClose: () => void;
  onUpdateItem: (itemId: string, patch: Partial<CollectItem>) => void;
  onStartWriting?: (item: CollectItem) => void;
};

function PropertyRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="harvy-notion-prop-row">
      <div className="harvy-notion-prop-label">
        <span className="harvy-notion-prop-icon" aria-hidden>
          {icon}
        </span>
        {label}
      </div>
      <div className="harvy-notion-prop-value min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function CollectItemModal({
  open,
  item,
  onClose,
  onUpdateItem,
  onStartWriting,
}: CollectItemModalProps) {
  if (!item) return null;

  const title = item.preview.trim() || "Untitled";
  const notesEmpty = !(item.body ?? "").trim();

  return (
    <CenteredOverlayModal
      open={open}
      onClose={onClose}
      title={title}
      titleId="harvy-collect-item-title"
      titleClassName="sr-only"
      backdropLabel="Close idea"
      closeLabel="Close idea"
      maxWidthClass="max-w-[min(720px,calc(100vw-3rem))]"
      headerClassName="absolute right-3 top-3 z-10 flex justify-end"
      bodyClassName="min-h-0 flex-1 overflow-y-auto px-12 pb-10 pt-14"
      panelClassName="harvy-notion-peek"
      autoFocusCloseButton={false}
    >
      <div className="space-y-1">
        <textarea
          id="harvy-collect-item-preview"
          value={item.preview}
          onChange={(event) => onUpdateItem(item.id, { preview: event.target.value })}
          placeholder="Untitled"
          rows={2}
          className="harvy-notion-peek-title"
          aria-label="Title"
        />

        <div className="mt-4 space-y-0.5">
          {item.status ? (
            <PropertyRow icon={<ChevronDown size={14} strokeWidth={1.75} />} label="Status">
              <span className="harvy-notion-pill harvy-notion-pill--status">{item.status}</span>
            </PropertyRow>
          ) : null}
          {item.notionPageId ? (
            <PropertyRow icon={<FileText size={14} strokeWidth={1.75} />} label="Source">
              <span className="harvy-notion-prop-plain">Notion</span>
            </PropertyRow>
          ) : null}
          <PropertyRow icon={<FileText size={14} strokeWidth={1.75} />} label="Added">
            <span className="harvy-notion-prop-plain">
              {formatCollectDateCreated(item.dateCreated)}
            </span>
          </PropertyRow>
        </div>

        <div className="harvy-notion-peek-divider" />

        <div className="relative">
          <TypeIcon
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-0 top-2.5 text-muted/45"
            aria-hidden
          />
          <textarea
            id="harvy-collect-item-body"
            value={item.body ?? ""}
            onChange={(event) => onUpdateItem(item.id, { body: event.target.value })}
            placeholder="Empty"
            rows={8}
            className={`harvy-notion-peek-body ${notesEmpty ? "harvy-notion-peek-body--empty" : ""}`}
            aria-label="Notes"
          />
        </div>

        {onStartWriting ? (
          <div className="pt-6">
            <button
              type="button"
              className="harvy-notion-start-writing"
              onClick={() => onStartWriting(item)}
            >
              Start writing
            </button>
          </div>
        ) : null}
      </div>
    </CenteredOverlayModal>
  );
}
