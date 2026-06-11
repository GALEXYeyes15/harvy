import { useMemo, useState } from "react";
import {
  buildFormatGalleryCards,
  formatGalleryCardAspect,
  formatGalleryCardLabel,
  PLACEHOLDER_FORMAT_GROUPS,
  type FormatCardAspect,
  type FormatGalleryCard,
} from "../features/format/formatOutputs";
import type { DocumentPreviewBlock } from "../features/format/documentPreviewBlocks";
import { distributeFormatGalleryCards } from "../features/format/formatMasonry";
import { useFormatGalleryColumnCount } from "../features/format/useFormatGalleryColumnCount";
import { FormatFeaturedPreview } from "./FormatFeaturedPreview";
import { FormatOutputModal } from "./FormatOutputModal";

const CARD_BASE =
  "harvy-format-gallery-card group w-full cursor-pointer rounded-xl text-left active:scale-[0.995]";

const CARD_ASPECT_CLASS: Record<FormatCardAspect, string> = {
  "16:9": "aspect-[16/9]",
  "3:4": "aspect-[3/4]",
  "9:16": "aspect-[9/16]",
  "8.5:11": "aspect-[8.5/11]",
  "1:1": "aspect-square",
};

type FormatGalleryPanelProps = {
  documentTitle: string;
  documentPreviewBlocks: DocumentPreviewBlock[];
};

function FeaturedFormatCard({
  title,
  previewBlocks,
  onClick,
}: {
  title: string;
  previewBlocks: DocumentPreviewBlock[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${CARD_BASE} flex h-[11.5rem] flex-col overflow-hidden px-6 py-6`}
      onClick={onClick}
    >
      <p className="shrink-0 text-[18px] font-semibold leading-snug tracking-[-0.01em] text-ink">
        {title}
      </p>
      <div className="relative mt-2 min-h-0 flex-1 basis-0 overflow-hidden">
        <FormatFeaturedPreview blocks={previewBlocks} />
        <div className="harvy-format-featured-preview-fade" aria-hidden />
      </div>
    </button>
  );
}

function FormatGalleryCardButton({
  card,
  onClick,
}: {
  card: FormatGalleryCard;
  onClick: () => void;
}) {
  const isCollection = card.kind === "collection";
  const aspect = formatGalleryCardAspect(card);

  return (
    <button
      type="button"
      className={`${CARD_BASE} ${CARD_ASPECT_CLASS[aspect]} flex flex-col px-5 py-5`}
      onClick={onClick}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted/55">
        {isCollection ? "Collection" : card.category}
      </p>
      <p className="mt-3 text-[1.05rem] font-semibold leading-snug tracking-[-0.01em] text-ink">
        {isCollection ? `${card.title} — ${card.count} generated` : card.title}
      </p>
      {card.kind === "individual" && card.subtitle ? (
        <p className="mt-2 text-[12px] leading-relaxed text-muted/65">{card.subtitle}</p>
      ) : null}
      {isCollection ? (
        <p className="mt-2 text-[12px] leading-relaxed text-muted/65">Open collection</p>
      ) : null}
    </button>
  );
}

export function FormatGalleryPanel({ documentTitle, documentPreviewBlocks }: FormatGalleryPanelProps) {
  const [activeCardTitle, setActiveCardTitle] = useState<string | null>(null);
  const galleryCards = useMemo(() => buildFormatGalleryCards(PLACEHOLDER_FORMAT_GROUPS), []);
  const columnCount = useFormatGalleryColumnCount();
  const masonryColumns = useMemo(
    () => distributeFormatGalleryCards(galleryCards, columnCount),
    [galleryCards, columnCount],
  );

  const openCard = (title: string) => setActiveCardTitle(title);

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-10 py-10 sm:px-14">
        <div className="flex flex-col gap-5">
          <FeaturedFormatCard
            title={documentTitle}
            previewBlocks={documentPreviewBlocks}
            onClick={() => openCard(documentTitle)}
          />

          <div className="flex gap-4">
            {masonryColumns.map((column, columnIndex) => (
              <div key={columnIndex} className="flex min-w-0 flex-1 flex-col gap-4">
                {column.map((card) => (
                  <FormatGalleryCardButton
                    key={card.id}
                    card={card}
                    onClick={() => openCard(formatGalleryCardLabel(card))}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <FormatOutputModal
        open={activeCardTitle !== null}
        title={activeCardTitle ?? "Format output"}
        onClose={() => setActiveCardTitle(null)}
      />
    </>
  );
}
