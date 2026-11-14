import { Check } from "lucide-react";
import {
  formatHighlightSourceLine,
  HIGHLIGHT_COLOR_CLASS,
  type ReaderHighlight,
  type ReaderHighlightGroup,
} from "../features/highlights/readerHighlights";
import { openSafeExternalUrl } from "../features/editor/openExternalUrl";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

/** Same "add to notes" glyph the Outliers cards use. */
function NoteFoldIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />
      <path d="M15 3v5a1 1 0 0 0 1 1h5" />
      <path d="M8 12h8" />
      <path d="M8 15h6" />
      <path d="M8 18h7" />
    </svg>
  );
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function HighlightBox({
  highlight,
  added,
  onAdd,
}: {
  highlight: ReaderHighlight;
  added: boolean;
  onAdd?: () => void;
}) {
  const meta = [highlight.chapter, highlight.created ? dateFormat.format(highlight.created) : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={`harvy-highlight-box ${HIGHLIGHT_COLOR_CLASS[highlight.color]} rounded-xl px-4 pb-4 pt-3`}
    >
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label={added ? "Added to document notes" : "Add to document notes"}
          title={added ? "Added to Notes" : "Add to Notes"}
          disabled={!onAdd}
          onClick={onAdd}
          className={`-ml-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-ink/[0.06] disabled:opacity-35 dark:hover:bg-white/[0.07] ${
            added ? "text-accent" : "text-muted/60 hover:text-ink dark:text-white/50 dark:hover:text-white/85"
          }`}
        >
          {added ? <Check size={15} strokeWidth={2} aria-hidden /> : <NoteFoldIcon />}
        </button>
        {meta ? (
          <span className="min-w-0 truncate text-[11px] text-muted/60 dark:text-white/40">{meta}</span>
        ) : null}
        {highlight.tags.length > 0 ? (
          <span className="ml-auto flex shrink-0 gap-2 text-[11px] text-accent/75">
            {highlight.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </span>
        ) : null}
      </div>

      <p className="harvy-highlight-quote mt-2 break-words whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
        {highlight.text}
      </p>

      {highlight.note ? (
        <p className="harvy-highlight-quote mt-3 break-words whitespace-pre-wrap text-ink/85 dark:text-white/80 [overflow-wrap:anywhere]">
          <strong className="font-semibold text-ink">Note:</strong> {highlight.note}
        </p>
      ) : null}
    </article>
  );
}

export function HighlightsBookModal({
  group,
  addedIds,
  onAdd,
  onClose,
}: {
  group: ReaderHighlightGroup | null;
  addedIds: Set<string>;
  onAdd?: (highlight: ReaderHighlight) => void;
  onClose: () => void;
}) {
  const first = group?.highlights[0];
  const url = first?.source.url ?? "";
  const count = group?.highlights.length ?? 0;
  const subtitleParts = [
    group?.author || (first ? formatHighlightSourceLine({ ...first.source, title: "" }) : ""),
    `${count} ${count === 1 ? "highlight" : "highlights"}`,
  ].filter(Boolean);

  return (
    <CenteredOverlayModal
      open={group !== null}
      onClose={onClose}
      title={group?.title ?? ""}
      titleId="harvy-highlights-book-title"
      titleClassName="harvy-highlight-quote text-[20px] font-semibold leading-snug tracking-[-0.01em] text-ink"
      subtitle={
        <span className="text-[12px] text-muted/65 dark:text-white/45">
          {subtitleParts.join(" · ")}
          {url ? (
            <>
              {" · "}
              <a
                href={url}
                onClick={(event) => openSafeExternalUrl(url, event)}
                className="underline decoration-line/40 underline-offset-2 hover:text-ink dark:hover:text-white/80"
              >
                Open source
              </a>
            </>
          ) : null}
        </span>
      }
      backdropLabel="Close highlights"
      closeLabel="Close highlights"
      maxWidthClass="max-w-[min(720px,calc(100vw-3rem))]"
      panelSizeClassName="flex h-[min(860px,88vh)] w-full max-w-[min(720px,calc(100vw-3rem))] max-h-[88vh] min-h-0"
      bodyClassName="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2"
    >
      {group ? (
        <div className="flex flex-col gap-3">
          {group.highlights.map((highlight) => (
            <HighlightBox
              key={highlight.id}
              highlight={highlight}
              added={addedIds.has(highlight.id)}
              onAdd={onAdd ? () => onAdd(highlight) : undefined}
            />
          ))}
        </div>
      ) : null}
    </CenteredOverlayModal>
  );
}
