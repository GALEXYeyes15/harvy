import { BookmarkPlus, Eye, Heart, MessageCircle, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { distributeOutlierPosts } from "../features/outliers/outlierMasonry";
import { MOCK_OUTLIER_POSTS, type MockOutlierPost } from "../features/outliers/mockOutlierPosts";
import { useFormatGalleryColumnCount } from "../features/format/useFormatGalleryColumnCount";

const BAR_ACTION =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted/55 transition-colors hover:bg-white/[0.06] hover:text-ink dark:hover:text-white/88";

function OutliersSearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="harvy-outlier-search-bar w-full">
      <Search size={15} strokeWidth={1.75} aria-hidden className="harvy-outlier-search-icon shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search sources or paste creator page link…"
        className="harvy-outlier-search-input min-w-0 flex-1"
        aria-label="Search sources or paste creator page link"
      />
      <div className="harvy-outlier-search-actions shrink-0">
        <button type="button" className={BAR_ACTION} aria-label="Filter sources">
          <SlidersHorizontal size={14} strokeWidth={1.75} aria-hidden />
        </button>
        <button type="button" className={BAR_ACTION} aria-label="Add source">
          <Plus size={15} strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  );
}

const THUMBNAIL_TONE_CLASS: Record<NonNullable<MockOutlierPost["thumbnailTone"]>, string> = {
  slate: "harvy-outlier-thumb--slate",
  warm: "harvy-outlier-thumb--warm",
  cool: "harvy-outlier-thumb--cool",
};

function OutlierThumbnail({ post }: { post: MockOutlierPost }) {
  if (!post.hasThumbnail) return null;

  const tone = THUMBNAIL_TONE_CLASS[post.thumbnailTone ?? "slate"];
  const heightClass = post.thumbnailHeight === "tall" ? "h-[10.5rem]" : "h-[6.5rem]";

  return (
    <div
      className={`harvy-outlier-thumb mt-3 w-full rounded-lg ${heightClass} ${tone}`}
      aria-hidden
    />
  );
}

function OutlierCard({ post }: { post: MockOutlierPost }) {
  return (
    <article className="harvy-outlier-card flex flex-col px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-snug text-ink">{post.creatorName}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted/65 dark:text-white/45">
            {post.handle} · {post.platform} · {post.postedAgo}
          </p>
        </div>
        <button
          type="button"
          aria-label="Save to Collect"
          className="shrink-0 rounded-md p-1 text-muted/50 transition-colors hover:bg-white/[0.06] hover:text-ink dark:hover:text-white/80"
        >
          <BookmarkPlus size={14} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-ink/88 dark:text-white/82">{post.preview}</p>

      <OutlierThumbnail post={post} />

      {post.captionBelowThumbnail ? (
        <p className="mt-2.5 text-[11px] leading-snug text-muted/70 dark:text-white/50">
          {post.captionBelowThumbnail}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/15 pt-3 dark:border-white/[0.06]">
        <div className="flex min-w-0 items-center gap-3 text-[10px] tabular-nums text-muted/60 dark:text-white/40">
          <span className="inline-flex items-center gap-1">
            <Heart size={11} strokeWidth={1.75} aria-hidden />
            {post.likes}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={11} strokeWidth={1.75} aria-hidden />
            {post.comments}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye size={11} strokeWidth={1.75} aria-hidden />
            {post.views}
          </span>
        </div>
        <span className="harvy-outlier-badge shrink-0">{post.outlierMultiple}</span>
      </div>
    </article>
  );
}

export function OutliersView() {
  const [searchQuery, setSearchQuery] = useState("");
  const columnCount = useFormatGalleryColumnCount();
  const masonryColumns = useMemo(
    () => distributeOutlierPosts(MOCK_OUTLIER_POSTS, columnCount),
    [columnCount],
  );

  return (
    <div className="mt-7 min-h-0 flex-1">
      <OutliersSearchBar value={searchQuery} onChange={setSearchQuery} />

      <div className="mt-5 flex gap-4">
        {masonryColumns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex min-w-0 flex-1 flex-col gap-4">
            {column.map((post) => (
              <OutlierCard key={post.id} post={post} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
