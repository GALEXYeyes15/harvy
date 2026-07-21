import {
  Check,
  Heart,
  MessageCircle,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  fetchSubstackOutlierPosts,
  hasCachedSubstackOutliers,
  isCachedSubstackOutliersFresh,
  readCachedSubstackOutlierPosts,
} from "../features/outliers/fetchSubstackOutliers";
import { distributeOutlierPosts } from "../features/outliers/outlierMasonry";
import {
  filterOutlierPosts,
  toggleContentType,
  type ContentTypeFilter,
  type OutlierPost,
  type OutlierScoreFilter,
  type PostedWithinFilter,
} from "../features/outliers/outlierPosts";
import {
  readOutliersSettings,
  writeOutliersSettings,
} from "../features/outliers/outliersSettings";
import {
  isSubstackNoteDoc,
  SubstackNoteBody,
  substackNoteDocToPlainText,
} from "../features/outliers/substackNoteBody";
import { useOutlierColumnCount } from "../features/outliers/useOutlierColumnCount";
import { OutlierDetailModal } from "./OutlierDetailModal";

/** Note page with dog-ear fold at the top-right (matches Lucide stroke style). */
function NoteFoldIcon({
  size = 14,
  strokeWidth = 1.75,
}: {
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
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

const BAR_ACTION =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted/55 transition-colors hover:bg-white/[0.06] hover:text-ink dark:hover:text-white/88";

const OUTLIER_SCORE_OPTIONS = [
  { id: "any", label: "Any" },
  { id: "3x", label: "3x or more" },
  { id: "5x", label: "5x or more" },
  { id: "10x", label: "10x or more" },
  { id: "20x", label: "20x or more" },
] as const satisfies ReadonlyArray<{ id: OutlierScoreFilter; label: string }>;

const POSTED_WITHIN_OPTIONS = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "3months", label: "3 Months" },
  { id: "year", label: "Year" },
] as const satisfies ReadonlyArray<{ id: PostedWithinFilter; label: string }>;

const CONTENT_TYPE_OPTIONS = [
  { key: "showNotes", label: "Notes" },
  { key: "showPosts", label: "Posts" },
] as const satisfies ReadonlyArray<{
  key: keyof ContentTypeFilter;
  label: string;
}>;

function ExclusiveCheckboxOption({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-ink/[0.04] dark:hover:bg-white/[0.04]"
    >
      <span
        className={`harvy-checkbox flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-sm ${
          checked
            ? "harvy-checkbox--checked"
            : "border border-line/45 bg-transparent dark:border-white/22"
        }`}
        aria-hidden
      >
        {checked ? <Check size={14} strokeWidth={2.75} className="text-white" /> : null}
      </span>
      <span className="text-[13px] leading-snug text-ink">{label}</span>
    </button>
  );
}

function ToggleCheckboxOption({
  label,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-ink/[0.04] disabled:cursor-not-allowed disabled:opacity-45 dark:hover:bg-white/[0.04]"
    >
      <span
        className={`harvy-checkbox flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-sm ${
          checked
            ? "harvy-checkbox--checked"
            : "border border-line/45 bg-transparent dark:border-white/22"
        }`}
        aria-hidden
      >
        {checked ? <Check size={14} strokeWidth={2.75} className="text-white" /> : null}
      </span>
      <span className="text-[13px] leading-snug text-ink">{label}</span>
    </button>
  );
}

function useOutliersPopoverDismiss(
  open: boolean,
  onClose: () => void,
  rootRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, onClose, rootRef]);
}

type OutliersAccountDropdownProps = {
  accountLink: string;
  onAccountLinkChange: (value: string) => void;
  onApplyAccount: () => void;
  isLoading: boolean;
};

function OutliersAccountDropdown({
  accountLink,
  onAccountLinkChange,
  onApplyAccount,
  isLoading,
}: OutliersAccountDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  useOutliersPopoverDismiss(open, closeMenu, rootRef);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={BAR_ACTION}
        aria-label="Account link"
        title="Account link"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Plus size={15} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Account link"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[17.5rem] rounded-lg bg-page px-3.5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.28)] ring-1 ring-line/40 dark:bg-[#1e1e1e] dark:ring-white/10"
        >
          <p className="text-[13px] font-semibold tracking-tight text-ink">Account link</p>
          <label htmlFor="harvy-outlier-account-link" className="mt-3 block">
            <span className="sr-only">Substack profile URL</span>
            <input
              ref={inputRef}
              id="harvy-outlier-account-link"
              type="url"
              value={accountLink}
              onChange={(event) => onAccountLinkChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (isLoading || !accountLink.trim()) return;
                onApplyAccount();
              }}
              placeholder="https://substack.com/@…"
              className="mt-0 w-full rounded-md border-0 bg-canvas/45 px-2.5 py-2 text-[13px] text-ink outline-none ring-1 ring-line/20 placeholder:text-muted/55 focus:ring-ink/20 dark:bg-canvas/35"
            />
          </label>
          <button
            type="button"
            disabled={isLoading || !accountLink.trim()}
            onClick={() => {
              onApplyAccount();
            }}
            className="mt-2 w-full rounded-md bg-ink/[0.08] px-2.5 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-ink/[0.12] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/[0.08] dark:hover:bg-white/[0.12]"
          >
            {isLoading ? "Loading..." : "Fetch posts"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type OutliersSettingsDropdownProps = {
  contentType: ContentTypeFilter;
  onContentTypeChange: (value: ContentTypeFilter) => void;
  outlierScore: OutlierScoreFilter;
  onOutlierScoreChange: (value: OutlierScoreFilter) => void;
  postedWithin: PostedWithinFilter;
  onPostedWithinChange: (value: PostedWithinFilter) => void;
};

function OutliersSettingsDropdown({
  contentType,
  onContentTypeChange,
  outlierScore,
  onOutlierScoreChange,
  postedWithin,
  onPostedWithinChange,
}: OutliersSettingsDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  useOutliersPopoverDismiss(open, closeMenu, rootRef);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={BAR_ACTION}
        aria-label="Outliers settings"
        title="Settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <SlidersHorizontal size={14} strokeWidth={1.75} aria-hidden />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Outliers settings"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[17.5rem] rounded-lg bg-page px-3.5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.28)] ring-1 ring-line/40 dark:bg-[#1e1e1e] dark:ring-white/10"
        >
          <p className="text-[13px] font-semibold tracking-tight text-ink">Settings</p>

          <div className="mt-3">
            <p
              id="harvy-outlier-content-type-label"
              className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/70"
            >
              Content type
            </p>
            <div
              className="mt-1.5 flex flex-col"
              role="group"
              aria-labelledby="harvy-outlier-content-type-label"
            >
              {CONTENT_TYPE_OPTIONS.map((option) => {
                const checked = contentType[option.key];
                const onlyThisOn =
                  checked &&
                  ((option.key === "showNotes" && !contentType.showPosts) ||
                    (option.key === "showPosts" && !contentType.showNotes));
                return (
                  <ToggleCheckboxOption
                    key={option.key}
                    label={option.label}
                    checked={checked}
                    disabled={onlyThisOn}
                    onToggle={() =>
                      onContentTypeChange(toggleContentType(contentType, option.key))
                    }
                  />
                );
              })}
            </div>
          </div>

          <div className="mt-3">
            <p
              id="harvy-outlier-score-label"
              className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/70"
            >
              Outlier score
            </p>
            <div
              className="mt-1.5 flex flex-col"
              role="radiogroup"
              aria-labelledby="harvy-outlier-score-label"
            >
              {OUTLIER_SCORE_OPTIONS.map((option) => (
                <ExclusiveCheckboxOption
                  key={option.id}
                  label={option.label}
                  checked={outlierScore === option.id}
                  onSelect={() => onOutlierScoreChange(option.id)}
                />
              ))}
            </div>
          </div>

          <div className="mt-3">
            <p
              id="harvy-outlier-posted-label"
              className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/70"
            >
              Posted within
            </p>
            <div
              className="mt-1.5 flex flex-col"
              role="radiogroup"
              aria-labelledby="harvy-outlier-posted-label"
            >
              {POSTED_WITHIN_OPTIONS.map((option) => (
                <ExclusiveCheckboxOption
                  key={option.id}
                  label={option.label}
                  checked={postedWithin === option.id}
                  onSelect={() => onPostedWithinChange(option.id)}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OutliersSearchBar({
  value,
  onChange,
  settings,
  account,
}: {
  value: string;
  onChange: (value: string) => void;
  settings: OutliersSettingsDropdownProps;
  account: OutliersAccountDropdownProps;
}) {
  return (
    <div className="harvy-outlier-search-bar w-full">
      <Search size={15} strokeWidth={1.75} aria-hidden className="harvy-outlier-search-icon shrink-0" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search posts…"
        className="harvy-outlier-search-input min-w-0 flex-1"
        aria-label="Search posts"
      />
      <div className="harvy-outlier-search-actions shrink-0">
        <OutliersAccountDropdown {...account} />
        <OutliersSettingsDropdown {...settings} />
      </div>
    </div>
  );
}

const THUMBNAIL_TONE_CLASS: Record<NonNullable<OutlierPost["thumbnailTone"]>, string> = {
  slate: "harvy-outlier-thumb--slate",
  warm: "harvy-outlier-thumb--warm",
  cool: "harvy-outlier-thumb--cool",
};

function OutlierThumbnail({ post }: { post: OutlierPost }) {
  if (!post.hasThumbnail) return null;

  const heightClass = post.thumbnailHeight === "tall" ? "h-[10.5rem]" : "h-[6.5rem]";

  if (post.thumbnailUrl) {
    return (
      <div className={`harvy-outlier-thumb mt-3 w-full overflow-hidden rounded-lg ${heightClass}`}>
        <img
          src={post.thumbnailUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  const tone = THUMBNAIL_TONE_CLASS[post.thumbnailTone ?? "slate"];
  return (
    <div
      className={`harvy-outlier-thumb mt-3 w-full rounded-lg ${heightClass} ${tone}`}
      aria-hidden
    />
  );
}

function OutlierCardAvatar({
  name,
  photoUrl,
}: {
  name: string;
  photoUrl?: string | null;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/[0.08] text-[10px] font-semibold text-ink/70 dark:bg-white/[0.08] dark:text-white/70"
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}

function OutlierCard({
  post,
  onAddToNotes,
  onOpen,
}: {
  post: OutlierPost;
  onAddToNotes?: (text: string) => void;
  onOpen: (post: OutlierPost) => void;
}) {
  return (
    <article className="harvy-outlier-card flex flex-col px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpen(post)}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        >
          <OutlierCardAvatar name={post.creatorName} photoUrl={post.creatorPhotoUrl} />
          <span className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-snug text-ink">
              {post.creatorName}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted/65 dark:text-white/45">
              {post.handle} · {post.platform} · {post.postedAgo}
            </p>
          </span>
        </button>
        <button
          type="button"
          aria-label="Add to document notes"
          title="Add to Notes"
          disabled={!onAddToNotes || !post.preview.trim()}
          onClick={(event) => {
            event.stopPropagation();
            const body = isSubstackNoteDoc(post.noteBodyJson)
              ? substackNoteDocToPlainText(post.noteBodyJson)
              : post.preview.trim();
            if (!body) return;
            onAddToNotes?.(`Note:\n${body}`);
          }}
          className="shrink-0 rounded-md p-1 text-muted/50 transition-colors hover:bg-white/[0.06] hover:text-ink disabled:opacity-35 dark:hover:text-white/80"
        >
          <NoteFoldIcon size={14} strokeWidth={1.75} />
        </button>
      </div>

      <button type="button" onClick={() => onOpen(post)} className="mt-3 w-full text-left">
        {isSubstackNoteDoc(post.noteBodyJson) ? (
          <SubstackNoteBody doc={post.noteBodyJson} />
        ) : (
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink/88 dark:text-white/82">
            {post.preview}
          </p>
        )}
      </button>

      <button type="button" onClick={() => onOpen(post)} className="text-left">
        <OutlierThumbnail post={post} />
      </button>

      {post.captionBelowThumbnail ? (
        <p className="mt-2.5 text-[11px] leading-snug text-muted/70 dark:text-white/50">
          {post.captionBelowThumbnail}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line/15 pt-3 dark:border-white/[0.06]">
        <div className="flex min-w-0 items-center gap-3 text-[10px] tabular-nums text-muted/60 dark:text-white/40">
          <span className="inline-flex items-center gap-1" title="Likes">
            <Heart size={11} strokeWidth={1.75} aria-hidden />
            {post.likes}
          </span>
          <span className="inline-flex items-center gap-1" title="Comments">
            <MessageCircle size={11} strokeWidth={1.75} aria-hidden />
            {post.comments}
          </span>
        </div>
        <span className="harvy-outlier-badge shrink-0" title="Likes vs your average">
          {post.outlierMultiple}
        </span>
      </div>
    </article>
  );
}

export function OutliersView({
  onAddToNotes,
}: {
  onAddToNotes?: (text: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [accountLink, setAccountLink] = useState(() => readOutliersSettings().accountLink);
  const [contentType, setContentType] = useState<ContentTypeFilter>(
    () => readOutliersSettings().contentType,
  );
  const [outlierScore, setOutlierScore] = useState<OutlierScoreFilter>(
    () => readOutliersSettings().outlierScore,
  );
  const [postedWithin, setPostedWithin] = useState<PostedWithinFilter>(
    () => readOutliersSettings().postedWithin,
  );
  const [posts, setPosts] = useState<OutlierPost[]>(() => {
    const { accountLink: savedAccount } = readOutliersSettings();
    return readCachedSubstackOutlierPosts(savedAccount) ?? [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    const { accountLink: savedAccount } = readOutliersSettings();
    // Only block the UI when we have nothing persisted to show.
    return !hasCachedSubstackOutliers(savedAccount);
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePost, setActivePost] = useState<OutlierPost | null>(null);
  const columnCount = useOutlierColumnCount();

  const persistSettings = useCallback((partial: Parameters<typeof writeOutliersSettings>[0]) => {
    writeOutliersSettings(partial);
  }, []);

  const handleAccountLinkChange = useCallback(
    (value: string) => {
      setAccountLink(value);
      persistSettings({ accountLink: value });
    },
    [persistSettings],
  );

  const handleContentTypeChange = useCallback(
    (value: ContentTypeFilter) => {
      setContentType(value);
      persistSettings({ contentType: value });
    },
    [persistSettings],
  );

  const handleOutlierScoreChange = useCallback(
    (value: OutlierScoreFilter) => {
      setOutlierScore(value);
      persistSettings({ outlierScore: value });
    },
    [persistSettings],
  );

  const handlePostedWithinChange = useCallback(
    (value: PostedWithinFilter) => {
      setPostedWithin(value);
      persistSettings({ postedWithin: value });
    },
    [persistSettings],
  );

  const loadPosts = useCallback(async (url: string, forceRefresh = false) => {
    const cachedPosts = readCachedSubstackOutlierPosts(url);
    const cacheFresh = isCachedSubstackOutliersFresh(url);

    // Offline-first: always paint the last successful fetch immediately.
    if (cachedPosts && !forceRefresh) {
      setPosts(cachedPosts);
      setIsLoading(false);
      setError(null);
      if (cacheFresh) return;

      // Stale cache: refresh in the background; keep cards if offline / fetch fails.
      setIsRefreshing(true);
      try {
        const next = await fetchSubstackOutlierPosts(url, { forceRefresh: true });
        setPosts(next.posts);
      } catch {
        // Keep persisted posts — no error banner when we already have a last fetch.
      } finally {
        setIsRefreshing(false);
      }
      return;
    }

    // No cache, or explicit Apply refresh.
    setIsLoading(true);
    setIsRefreshing(false);
    setError(null);
    try {
      const next = await fetchSubstackOutlierPosts(url, { forceRefresh });
      setPosts(next.posts);
      setError(null);
    } catch (err) {
      if (cachedPosts) {
        setPosts(cachedPosts);
        // Force refresh failed but last fetch is still usable.
        setError(null);
      } else {
        setPosts([]);
        setError(err instanceof Error ? err.message : "Could not load Substack posts.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts(readOutliersSettings().accountLink);
  }, [loadPosts]);

  const filteredPosts = useMemo(() => {
    const byFilters = filterOutlierPosts(posts, {
      score: outlierScore,
      postedWithin,
      contentType,
    });
    const query = searchQuery.trim().toLowerCase();
    if (!query) return byFilters;
    return byFilters.filter(
      (post) =>
        post.preview.toLowerCase().includes(query) ||
        post.captionBelowThumbnail?.toLowerCase().includes(query) ||
        post.creatorName.toLowerCase().includes(query),
    );
  }, [posts, outlierScore, postedWithin, contentType, searchQuery]);

  const masonryColumns = useMemo(
    () => distributeOutlierPosts(filteredPosts, columnCount),
    [filteredPosts, columnCount],
  );

  return (
    <div className="mt-7 min-h-0 flex-1">
      <OutliersSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        settings={{
          contentType,
          onContentTypeChange: handleContentTypeChange,
          outlierScore,
          onOutlierScoreChange: handleOutlierScoreChange,
          postedWithin,
          onPostedWithinChange: handlePostedWithinChange,
        }}
        account={{
          accountLink,
          onAccountLinkChange: handleAccountLinkChange,
          onApplyAccount: () => {
            persistSettings({ accountLink });
            void loadPosts(accountLink, true);
          },
          isLoading: isLoading || isRefreshing,
        }}
      />

      {error ? (
        <p className="mt-5 text-[13px] text-muted/75">{error}</p>
      ) : null}

      {isLoading && posts.length === 0 ? (
        <p className="mt-5 text-[13px] text-muted/65">Loading Substack posts…</p>
      ) : null}

      {!isLoading && !error && filteredPosts.length === 0 ? (
        <p className="mt-5 text-[13px] text-muted/65">
          No posts match these filters. Try a wider date range or a lower outlier score.
        </p>
      ) : null}

      <div className="mt-5 flex gap-4">
        {masonryColumns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex min-w-0 flex-1 flex-col gap-4">
            {column.map((post) => (
              <OutlierCard
                key={post.id}
                post={post}
                onAddToNotes={onAddToNotes}
                onOpen={setActivePost}
              />
            ))}
          </div>
        ))}
      </div>

      <OutlierDetailModal
        open={activePost !== null}
        post={activePost}
        onClose={() => setActivePost(null)}
      />
    </div>
  );
}
