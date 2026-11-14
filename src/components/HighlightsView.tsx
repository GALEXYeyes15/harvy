import { Check, Plus, RefreshCw, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { openSafeExternalUrl } from "../features/editor/openExternalUrl";
import {
  formatHighlightForNotes,
  formatHighlightSourceLine,
  groupHighlightsBySource,
  HIGHLIGHT_COLOR_CLASS,
  sharperCoverUrl,
  highlightMatchesQuery,
  type ReaderHighlight,
  type ReaderHighlightColor,
  type ReaderHighlightGroup,
} from "../features/highlights/readerHighlights";
import { useReaderCover } from "../features/highlights/useReaderCover";
import { useReaderHighlights } from "../features/highlights/useReaderHighlights";
import { formatFetchedAgo } from "../features/outliers/outlierPosts";
import { useOutlierColumnCount } from "../features/outliers/useOutlierColumnCount";
import { HighlightsBookModal } from "./HighlightsBookModal";

const COLOR_ORDER: ReaderHighlightColor[] = ["yellow", "green", "blue", "rose"];

const COLOR_LABEL: Record<ReaderHighlightColor, string> = {
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  rose: "Rose",
};

type HighlightsSort = "newest" | "book";

const SORT_STORAGE_KEY = "harvy:highlights-sort";

const SORT_LABEL: Record<HighlightsSort, string> = {
  newest: "Newest",
  book: "By book",
};

function readSort(): HighlightsSort {
  try {
    return localStorage.getItem(SORT_STORAGE_KEY) === "book" ? "book" : "newest";
  } catch {
    return "newest";
  }
}

function writeSort(sort: HighlightsSort) {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, sort);
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}

const BAR_ACTION =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-accent/65 transition-colors hover:bg-ink/[0.05] hover:text-accent disabled:opacity-40 dark:hover:bg-white/[0.06]";

/** Rough card height so masonry columns stay balanced. */
function estimateHeight(highlight: ReaderHighlight): number {
  return 1 + highlight.text.length / 160 + (highlight.note ? 0.4 + highlight.note.length / 220 : 0);
}

function distributeHighlights(highlights: ReaderHighlight[], columnCount: number): ReaderHighlight[][] {
  const count = Math.max(1, columnCount);
  const columns = Array.from({ length: count }, () => [] as ReaderHighlight[]);
  const heights = new Array<number>(count).fill(0);
  for (const highlight of highlights) {
    let target = 0;
    for (let i = 1; i < count; i += 1) {
      if (heights[i]! < heights[target]!) target = i;
    }
    columns[target]!.push(highlight);
    heights[target]! += estimateHeight(highlight);
  }
  return columns;
}

function HighlightMasonry({
  highlights,
  columnCount,
  isReflowing,
  addedIds,
  onAdd,
  className = "mt-5",
}: {
  highlights: ReaderHighlight[];
  columnCount: number;
  isReflowing: boolean;
  addedIds: Set<string>;
  onAdd?: (highlight: ReaderHighlight) => void;
  className?: string;
}) {
  const columns = useMemo(
    () => distributeHighlights(highlights, columnCount),
    [highlights, columnCount],
  );
  return (
    <div
      className={`harvy-outlier-masonry ${className} flex gap-4`}
      data-reflowing={isReflowing ? "true" : undefined}
    >
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className="harvy-outlier-masonry-col flex min-w-0 flex-1 flex-col gap-4">
          {column.map((highlight) => (
            <HighlightCard
              key={highlight.id}
              highlight={highlight}
              added={addedIds.has(highlight.id)}
              onAdd={onAdd ? () => onAdd(highlight) : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function HighlightCard({
  highlight,
  added,
  onAdd,
}: {
  highlight: ReaderHighlight;
  added: boolean;
  onAdd?: () => void;
}) {
  const sourceLine = formatHighlightSourceLine(highlight.source);
  const meta = [sourceLine, highlight.chapter].filter(Boolean).join(" · ");

  return (
    <article
      className={`harvy-outlier-card harvy-highlight-card ${HIGHLIGHT_COLOR_CLASS[highlight.color]} flex min-w-0 flex-col px-4 py-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 break-words whitespace-pre-wrap text-[13px] leading-relaxed text-ink [overflow-wrap:anywhere]">
          {highlight.text}
        </p>
        <button
          type="button"
          aria-label={added ? "Added to document notes" : "Add to document notes"}
          title={added ? "Added to Notes" : "Add to Notes"}
          disabled={!onAdd}
          onClick={onAdd}
          className="shrink-0 rounded-md p-1 text-muted/50 transition-colors hover:bg-ink/[0.05] hover:text-ink disabled:opacity-35 dark:hover:bg-white/[0.06] dark:hover:text-white/80"
        >
          {added ? (
            <Check size={14} strokeWidth={2} aria-hidden />
          ) : (
            <Plus size={14} strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>

      {highlight.note ? (
        <p className="mt-2.5 break-words whitespace-pre-wrap text-[12px] leading-snug text-muted/80 dark:text-white/55 [overflow-wrap:anywhere]">
          {highlight.note}
        </p>
      ) : null}

      {meta || highlight.tags.length > 0 || highlight.favorite ? (
        <div className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line/15 pt-3 text-[11px] text-muted/65 dark:border-white/[0.06] dark:text-white/45">
          {highlight.favorite ? (
            <Star size={11} strokeWidth={2} className="shrink-0 fill-current" aria-label="Favorite" />
          ) : null}
          {meta ? (
            highlight.source.url ? (
              <a
                href={highlight.source.url}
                onClick={(event) => openSafeExternalUrl(highlight.source.url, event)}
                className="min-w-0 truncate hover:text-ink dark:hover:text-white/80"
                title={highlight.source.url}
              >
                {meta}
              </a>
            ) : (
              <span className="min-w-0 truncate" title={meta}>
                {meta}
              </span>
            )
          ) : null}
          {highlight.tags.map((tag) => (
            <span key={tag} className="shrink-0 text-accent/75">
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

/** Muted cover tones for books, picked from the title so a book keeps its color. */
const COVER_TONES = [
  "#3d4a5c",
  "#5b4636",
  "#44564a",
  "#5a3f4a",
  "#4b4763",
  "#6a5a3a",
  "#3f5658",
  "#5e4a3a",
];

function coverTone(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) hash = (hash * 31 + title.charCodeAt(i)) | 0;
  return COVER_TONES[Math.abs(hash) % COVER_TONES.length]!;
}

function HighlightBookCard({
  group,
  onOpen,
}: {
  group: ReaderHighlightGroup;
  onOpen: () => void;
}) {
  const count = group.highlights.length;
  const localCover = useReaderCover(group.cover);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const coverUrl =
    localCover ?? (group.coverUrl && !remoteFailed ? sharperCoverUrl(group.coverUrl) : null);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="harvy-outlier-card harvy-highlight-book flex min-w-0 flex-col overflow-hidden text-left"
      aria-label={`${group.title}, ${count} ${count === 1 ? "highlight" : "highlights"}`}
    >
      <div className="harvy-highlight-book-shelf flex h-44 w-full items-center justify-center">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="harvy-highlight-book-cover h-36 max-w-[7.5rem] object-cover"
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setRemoteFailed(true)}
          />
        ) : (
          <div
            className="harvy-highlight-book-cover flex h-36 w-24 flex-col justify-between px-2.5 py-3"
            style={{ backgroundColor: coverTone(group.title) }}
            aria-hidden
          >
            <span className="harvy-highlight-quote line-clamp-4 text-[11px] font-semibold leading-tight text-white/92">
              {group.title}
            </span>
            {group.author ? (
              <span className="line-clamp-2 text-[8px] uppercase tracking-[0.08em] text-white/65">
                {group.author}
              </span>
            ) : null}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-4 pb-4 pt-3.5">
        <p className="harvy-highlight-quote line-clamp-3 text-[17px] font-semibold leading-snug text-ink">
          {group.title}
        </p>
        {group.author ? (
          <p className="harvy-highlight-quote mt-2 truncate text-[14px] text-ink/80 dark:text-white/75">
            {group.author}
          </p>
        ) : null}
        <p className="mt-auto pt-3 text-[12px] tabular-nums text-muted/60 dark:text-white/40">
          {count} {count === 1 ? "highlight" : "highlights"}
        </p>
      </div>
    </button>
  );
}

export function HighlightsView({
  onAddToNotes,
  workspaceSidebarOpen = true,
  toolsSidebarOpen = true,
}: {
  onAddToNotes?: (text: string) => void;
  workspaceSidebarOpen?: boolean;
  toolsSidebarOpen?: boolean;
}) {
  const { index, isLoading, missing, error, reload } = useReaderHighlights(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [color, setColor] = useState<ReaderHighlightColor | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sort, setSort] = useState<HighlightsSort>(readSort);
  const [openBookKey, setOpenBookKey] = useState<string | null>(null);

  const { columnCount, isReflowing } = useOutlierColumnCount({
    workspaceSidebarOpen,
    toolsSidebarOpen,
  });

  const presentColors = useMemo(
    () => COLOR_ORDER.filter((c) => index.highlights.some((h) => h.color === c)),
    [index.highlights],
  );

  const filtered = useMemo(
    () =>
      index.highlights.filter(
        (h) => (color === null || h.color === color) && highlightMatchesQuery(h, searchQuery),
      ),
    [index.highlights, color, searchQuery],
  );

  const groups = useMemo(
    () => (sort === "book" ? groupHighlightsBySource(filtered) : []),
    [filtered, sort],
  );

  /** Looked up by key so the open popup follows reloads and searches. */
  const openBook = useMemo(
    () => groups.find((group) => group.key === openBookKey) ?? null,
    [groups, openBookKey],
  );

  const changeSort = (next: HighlightsSort) => {
    setSort(next);
    writeSort(next);
  };

  const addToNotes = (highlight: ReaderHighlight) => {
    onAddToNotes?.(formatHighlightForNotes(highlight));
    setAddedIds((current) => new Set(current).add(highlight.id));
  };

  const refresh = async () => {
    setIsRefreshing(true);
    try {
      await reload();
    } finally {
      setIsRefreshing(false);
    }
  };

  const status = isLoading
    ? null
    : missing
      ? null
      : index.updatedAt
        ? `${index.highlights.length} from Harvy Reader · updated ${formatFetchedAgo(index.updatedAt)}`
        : `${index.highlights.length} from Harvy Reader`;

  return (
    <div className="mt-7 min-h-0 flex-1">
      <div className="harvy-outlier-search-bar w-full">
        <Search size={15} strokeWidth={1.75} aria-hidden className="harvy-outlier-search-icon shrink-0" />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search highlights…"
          className="harvy-outlier-search-input min-w-0 flex-1"
          aria-label="Search highlights"
        />
        <div className="harvy-outlier-search-actions shrink-0">
          {presentColors.length > 1
            ? presentColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={BAR_ACTION}
                  aria-pressed={color === c}
                  aria-label={`Only ${COLOR_LABEL[c]} highlights`}
                  title={COLOR_LABEL[c]}
                  onClick={() => setColor((current) => (current === c ? null : c))}
                >
                  <span
                    className={`harvy-highlight-swatch ${HIGHLIGHT_COLOR_CLASS[c]} ${
                      color === c ? "is-active" : ""
                    }`}
                    aria-hidden
                  />
                </button>
              ))
            : null}
          <button
            type="button"
            className={BAR_ACTION}
            aria-label="Reload highlights"
            title="Reload from Harvy Reader"
            disabled={isRefreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw
              size={14}
              strokeWidth={1.75}
              className={isRefreshing ? "animate-spin" : undefined}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {status ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted/65 dark:text-white/45">
          <p className="min-w-0">{status}</p>
          {index.highlights.length > 0 ? (
            <div className="flex items-center gap-3" role="radiogroup" aria-label="Sort highlights">
              {(["newest", "book"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={sort === option}
                  onClick={() => changeSort(option)}
                  className={`border-0 bg-transparent p-0 font-medium transition-colors ${
                    sort === option
                      ? "text-ink dark:text-white/85"
                      : "hover:text-ink dark:hover:text-white/70"
                  }`}
                >
                  {SORT_LABEL[option]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-5 text-[13px] text-muted/75">{error}</p> : null}

      {isLoading ? <p className="mt-5 text-[13px] text-muted/65">Loading highlights…</p> : null}

      {!isLoading && !error && filtered.length === 0 ? (
        <p className="mt-5 text-[13px] text-muted/65">
          {missing
            ? "No highlights from Harvy Reader yet. Highlight something in Reader, then come back here."
            : index.highlights.length === 0
              ? "Harvy Reader has no highlights yet."
              : "No highlights match this search."}
        </p>
      ) : null}

      {sort === "book" ? (
        <div
          className="harvy-idea-gallery mt-5"
          data-reflowing={isReflowing ? "true" : undefined}
          style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
        >
          {groups.map((group) => (
            <HighlightBookCard
              key={group.key}
              group={group}
              onOpen={() => setOpenBookKey(group.key)}
            />
          ))}
        </div>
      ) : (
        <HighlightMasonry
          highlights={filtered}
          columnCount={columnCount}
          isReflowing={isReflowing}
          addedIds={addedIds}
          onAdd={onAddToNotes ? addToNotes : undefined}
        />
      )}

      <HighlightsBookModal
        group={sort === "book" ? openBook : null}
        addedIds={addedIds}
        onAdd={onAddToNotes ? addToNotes : undefined}
        onClose={() => setOpenBookKey(null)}
      />
    </div>
  );
}
