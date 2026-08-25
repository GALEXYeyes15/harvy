import {
  Check,
  CircleUser,
  Heart,
  MessageCircle,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
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
  fetchAllOutlierPosts,
  readCachedOutlierSourcesPosts,
} from "../features/outliers/fetchOutlierPosts";
import {
  latestOutliersCacheFetchedAt,
  outliersCacheKey,
  removeOutliersCacheForSource,
} from "../features/outliers/outliersCache";
import { distributeOutlierPosts } from "../features/outliers/outlierMasonry";
import {
  filterOutlierPosts,
  formatFetchedAgo,
  isOutlierNote,
  toggleContentType,
  type ContentTypeFilter,
  type OutlierPost,
  type OutlierScoreFilter,
  type PostedWithinFilter,
} from "../features/outliers/outlierPosts";
import {
  OUTLIERS_CACHE_UPDATED_EVENT,
} from "../features/outliers/useOutliersAutoRefresh";
import {
  OUTLIERS_SETTINGS_CHANGED_EVENT,
  readOutliersSettings,
  writeOutliersSettings,
} from "../features/outliers/outliersSettings";
import {
  createOutlierSource,
  detectOutlierPlatformFromUrl,
  formatOutlierSourceListLabel,
  OUTLIER_SOURCE_URL_PLACEHOLDER,
  validateOutlierSourceUrlAuto,
  type OutlierSource,
} from "../features/outliers/outlierSources";
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
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-accent/65 transition-colors hover:bg-white/[0.06] hover:text-accent dark:hover:text-accent";

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

type OutliersSourcesDropdownProps = {
  sources: OutlierSource[];
  onSourcesChange: (sources: OutlierSource[]) => void;
};

function OutliersSourcesDropdown({ sources, onSourcesChange }: OutliersSourcesDropdownProps) {
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setShowAddForm(false);
    setDraftUrl("");
    setDraftError(null);
  }, []);

  useOutliersPopoverDismiss(open, closeMenu, rootRef);

  useEffect(() => {
    if (!open || !showAddForm) return;
    inputRef.current?.focus();
  }, [open, showAddForm]);

  const handleAdd = () => {
    const validationError = validateOutlierSourceUrlAuto(draftUrl);
    if (validationError) {
      setDraftError(validationError);
      return;
    }
    const platform = detectOutlierPlatformFromUrl(draftUrl);
    if (!platform) {
      setDraftError("Use a Substack, Medium, or YouTube URL.");
      return;
    }
    const normalized = draftUrl.trim().replace(/\/+$/, "");
    const duplicate = sources.some(
      (source) =>
        source.platform === platform &&
        source.url.trim().replace(/\/+$/, "").toLowerCase() === normalized.toLowerCase(),
    );
    if (duplicate) {
      setDraftError("That source is already saved.");
      return;
    }
    const next = [
      ...sources,
      createOutlierSource({ platform, url: normalized }),
    ];
    onSourcesChange(next);
    setDraftUrl("");
    setDraftError(null);
    setShowAddForm(false);
  };

  const handleRemove = (id: string) => {
    removeOutliersCacheForSource(id);
    onSourcesChange(sources.filter((source) => source.id !== id));
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        className={BAR_ACTION}
        aria-label="Sources"
        title="Sources"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <CircleUser size={15} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Outlier sources"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[17.5rem] rounded-lg bg-page px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.28)] ring-1 ring-line/40 dark:bg-[#1e1e1e] dark:ring-white/10"
        >
          {sources.length > 0 ? (
            <ul className="max-h-36 space-y-0.5 overflow-y-auto">
              {sources.map((source) => (
                <li
                  key={source.id}
                  className="group flex items-center gap-1.5 rounded-md py-1 pl-1 pr-0.5 hover:bg-ink/[0.04] dark:hover:bg-white/[0.04]"
                >
                  <p className="min-w-0 flex-1 truncate text-[12px] text-ink">
                    {(() => {
                      const { handle, suffix } = formatOutlierSourceListLabel(source);
                      return (
                        <>
                          {handle}
                          <span className="text-muted/50">{suffix}</span>
                        </>
                      );
                    })()}
                  </p>
                  <button
                    type="button"
                    aria-label={`Remove ${source.label}`}
                    onClick={() => handleRemove(source.id)}
                    className="shrink-0 rounded p-1 text-muted/45 opacity-0 transition-opacity hover:text-ink focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    <Trash2 size={12} strokeWidth={2} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-1 pl-1 text-[12px] text-muted/55">No sources yet.</p>
          )}

          {showAddForm ? (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="url"
                  value={draftUrl}
                  onChange={(event) => {
                    setDraftUrl(event.target.value);
                    if (draftError) setDraftError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    handleAdd();
                  }}
                  placeholder={OUTLIER_SOURCE_URL_PLACEHOLDER}
                  aria-label="Source URL"
                  className="min-w-0 flex-1 rounded-md border-0 bg-canvas/45 px-2 py-1.5 text-[12px] text-ink outline-none ring-1 ring-line/20 placeholder:text-muted/50 focus:ring-ink/20 dark:bg-canvas/35"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  aria-label="Add source"
                  title="Add source"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink/[0.07] text-ink transition-colors hover:bg-ink/[0.11] dark:bg-white/[0.07] dark:hover:bg-white/[0.11]"
                >
                  <Check size={15} strokeWidth={2} aria-hidden />
                </button>
              </div>
              {draftError ? (
                <p className="text-[10px] leading-snug text-red-600/90 dark:text-red-400/90">{draftError}</p>
              ) : null}
            </div>
          ) : null}

          {!showAddForm ? (
            <div className="mt-2.5">
              <button
                type="button"
                aria-label="Add source"
                title="Add source"
                onClick={() => setShowAddForm(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-accent/65 transition-colors hover:bg-white/[0.06] hover:text-accent dark:hover:text-accent"
              >
                <Plus size={15} strokeWidth={2} aria-hidden />
              </button>
            </div>
          ) : null}
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
  onFetchPosts: () => void;
  isFetching: boolean;
  canFetch: boolean;
  lastFetchedAt: number | null;
};

function OutliersSettingsDropdown({
  contentType,
  onContentTypeChange,
  outlierScore,
  onOutlierScoreChange,
  postedWithin,
  onPostedWithinChange,
  onFetchPosts,
  isFetching,
  canFetch,
  lastFetchedAt,
}: OutliersSettingsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const rootRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  useOutliersPopoverDismiss(open, closeMenu, rootRef);

  useEffect(() => {
    if (!open) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [open]);

  const lastFetchedLabel =
    lastFetchedAt != null ? formatFetchedAgo(lastFetchedAt, nowMs) : "Never fetched";

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

          <button
            type="button"
            disabled={isFetching || !canFetch}
            onClick={onFetchPosts}
            className="mt-3 w-full rounded-md bg-ink/[0.08] px-2.5 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-ink/[0.12] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white/[0.08] dark:hover:bg-white/[0.12]"
          >
            {isFetching ? "Loading..." : "Fetch posts"}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-muted/65 dark:text-white/45">
            {lastFetchedAt != null ? `Last fetch ${lastFetchedLabel}` : lastFetchedLabel}
          </p>

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
  sources,
}: {
  value: string;
  onChange: (value: string) => void;
  settings: OutliersSettingsDropdownProps;
  sources: OutliersSourcesDropdownProps;
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
        <OutliersSourcesDropdown {...sources} />
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

/** Substack-style article link preview: cover image over author + title bar. */
function OutlierArticleLinkCard({ post }: { post: OutlierPost }) {
  const title = post.preview.trim() || "Untitled";
  const tone = THUMBNAIL_TONE_CLASS[post.thumbnailTone ?? "slate"];

  return (
    <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-line/20 dark:ring-white/[0.08]">
      {post.thumbnailUrl ? (
        <div className="aspect-[16/10] w-full overflow-hidden bg-ink/[0.04] dark:bg-white/[0.04]">
          <img
            src={post.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : post.hasThumbnail ? (
        <div className={`aspect-[16/10] w-full ${tone}`} aria-hidden />
      ) : null}

      <div className="flex items-start gap-2.5 bg-ink/[0.04] px-3 py-2.5 dark:bg-white/[0.06]">
        <OutlierCardAvatar
          name={post.creatorName}
          photoUrl={post.creatorPhotoUrl}
          size="sm"
          rounded="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] leading-snug text-muted/70 dark:text-white/50">
            {post.creatorName}
          </p>
          <p className="mt-0.5 break-words text-[13px] font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
            {title}
          </p>
        </div>
      </div>
    </div>
  );
}

function OutlierCardAvatar({
  name,
  photoUrl,
  size = "md",
  rounded = "full",
}: {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md";
  rounded?: "full" | "md";
}) {
  const sizeClass = size === "sm" ? "h-7 w-7 text-[9px]" : "h-8 w-8 text-[10px]";
  const roundClass = rounded === "md" ? "rounded-md" : "rounded-full";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        className={`${sizeClass} ${roundClass} shrink-0 object-cover`}
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
      className={`flex ${sizeClass} ${roundClass} shrink-0 items-center justify-center bg-ink/[0.08] font-semibold text-ink/70 dark:bg-white/[0.08] dark:text-white/70`}
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
  const isNote = isOutlierNote(post) || isSubstackNoteDoc(post.noteBodyJson);

  return (
    <article className="harvy-outlier-card flex min-w-0 flex-col overflow-hidden px-4 py-4">
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

      {isNote ? (
        <button type="button" onClick={() => onOpen(post)} className="mt-3 min-w-0 w-full overflow-hidden text-left">
          {isSubstackNoteDoc(post.noteBodyJson) ? (
            <SubstackNoteBody doc={post.noteBodyJson} />
          ) : (
            <p className="break-words whitespace-pre-wrap text-[12px] leading-relaxed text-ink/88 dark:text-white/82 [overflow-wrap:anywhere]">
              {post.preview}
            </p>
          )}
        </button>
      ) : (
        <button type="button" onClick={() => onOpen(post)} className="min-w-0 w-full overflow-hidden text-left">
          <OutlierArticleLinkCard post={post} />
        </button>
      )}

      {isNote ? (
        <>
          <button type="button" onClick={() => onOpen(post)} className="text-left">
            <OutlierThumbnail post={post} />
          </button>
          {post.captionBelowThumbnail ? (
            <p className="mt-2.5 text-[11px] leading-snug text-muted/70 dark:text-white/50">
              {post.captionBelowThumbnail}
            </p>
          ) : null}
        </>
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
  workspaceSidebarOpen = true,
  toolsSidebarOpen = true,
}: {
  onAddToNotes?: (text: string) => void;
  workspaceSidebarOpen?: boolean;
  toolsSidebarOpen?: boolean;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sources, setSources] = useState<OutlierSource[]>(
    () => readOutliersSettings().sources,
  );
  const [contentType, setContentType] = useState<ContentTypeFilter>(
    () => readOutliersSettings().contentType,
  );
  const [outlierScore, setOutlierScore] = useState<OutlierScoreFilter>(
    () => readOutliersSettings().outlierScore,
  );
  const [postedWithin, setPostedWithin] = useState<PostedWithinFilter>(
    () => readOutliersSettings().postedWithin,
  );
  const [posts, setPosts] = useState<OutlierPost[]>(() =>
    readCachedOutlierSourcesPosts(readOutliersSettings().sources),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePost, setActivePost] = useState<OutlierPost | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(() =>
    latestOutliersCacheFetchedAt(
      readOutliersSettings().sources.map((source) =>
        outliersCacheKey(source.id, source.platform, source.url),
      ),
    ),
  );
  const { columnCount, isReflowing } = useOutlierColumnCount({
    workspaceSidebarOpen,
    toolsSidebarOpen,
  });
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  const cacheKeys = useMemo(
    () => sources.map((source) => outliersCacheKey(source.id, source.platform, source.url)),
    [sources],
  );

  const persistSettings = useCallback((partial: Parameters<typeof writeOutliersSettings>[0]) => {
    writeOutliersSettings(partial);
  }, []);

  const syncLastFetchedAt = useCallback((keys: string[]) => {
    setLastFetchedAt(latestOutliersCacheFetchedAt(keys));
  }, []);

  const syncPostsFromCache = useCallback((currentSources: OutlierSource[], keys: string[]) => {
    setPosts(readCachedOutlierSourcesPosts(currentSources));
    syncLastFetchedAt(keys);
  }, [syncLastFetchedAt]);

  const handleSourcesChange = useCallback(
    (nextSources: OutlierSource[]) => {
      setSources(nextSources);
      persistSettings({ sources: nextSources, autoRefreshArmed: false });
      setPosts(readCachedOutlierSourcesPosts(nextSources));
      setError(null);
      setIsLoading(false);
      setIsRefreshing(false);
      syncLastFetchedAt(
        nextSources.map((source) => outliersCacheKey(source.id, source.platform, source.url)),
      );
    },
    [persistSettings, syncLastFetchedAt],
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

  const fetchPosts = useCallback(
    async (currentSources: OutlierSource[], keys: string[]) => {
      if (currentSources.length === 0) return;

      const cachedPosts = readCachedOutlierSourcesPosts(currentSources);
      const hadCache = cachedPosts.length > 0;

      if (hadCache) {
        setPosts(cachedPosts);
        setIsRefreshing(true);
        setIsLoading(false);
      } else {
        setIsLoading(true);
        setIsRefreshing(false);
      }
      setError(null);

      try {
        const next = await fetchAllOutlierPosts(currentSources, { forceRefresh: true });
        setPosts(next.posts);
        if (next.errors.length > 0 && next.posts.length === 0) {
          setError(next.errors[0] ?? "Could not load posts.");
        } else if (next.errors.length > 0) {
          setError(next.errors.join(" · "));
        } else {
          setError(null);
        }
        if (next.refreshedAny) syncLastFetchedAt(keys);
      } catch (err) {
        if (hadCache) {
          setPosts(cachedPosts);
          setError(null);
        } else {
          setPosts([]);
          setError(err instanceof Error ? err.message : "Could not load posts.");
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [syncLastFetchedAt],
  );

  const handleFetchPosts = useCallback(() => {
    if (sources.length === 0) return;
    persistSettings({ sources });
    void (async () => {
      await fetchPosts(sources, cacheKeys);
      if (readOutliersSettings().autoFetchEnabled) {
        writeOutliersSettings({ autoRefreshArmed: true });
        window.dispatchEvent(new CustomEvent(OUTLIERS_SETTINGS_CHANGED_EVENT));
      }
    })();
  }, [sources, cacheKeys, fetchPosts, persistSettings]);

  useEffect(() => {
    const onCacheUpdated = () => {
      syncPostsFromCache(sourcesRef.current, cacheKeys);
    };
    window.addEventListener(OUTLIERS_CACHE_UPDATED_EVENT, onCacheUpdated);
    return () => window.removeEventListener(OUTLIERS_CACHE_UPDATED_EVENT, onCacheUpdated);
  }, [cacheKeys, syncPostsFromCache]);

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
        sources={{
          sources,
          onSourcesChange: handleSourcesChange,
        }}
        settings={{
          contentType,
          onContentTypeChange: handleContentTypeChange,
          outlierScore,
          onOutlierScoreChange: handleOutlierScoreChange,
          postedWithin,
          onPostedWithinChange: handlePostedWithinChange,
          onFetchPosts: handleFetchPosts,
          isFetching: isLoading || isRefreshing,
          canFetch: sources.length > 0,
          lastFetchedAt,
        }}
      />

      {error ? (
        <p className="mt-5 text-[13px] text-muted/75">{error}</p>
      ) : null}

      {isLoading && posts.length === 0 ? (
        <p className="mt-5 text-[13px] text-muted/65">Loading posts…</p>
      ) : null}

      {!isLoading && !error && filteredPosts.length === 0 ? (
        <p className="mt-5 text-[13px] text-muted/65">
          {posts.length === 0
            ? sources.length === 0
              ? "Add a source with +, then use Fetch posts to load your grid."
              : "No cached posts yet. Use Fetch posts in Settings to load them."
            : "No posts match these filters. Try a wider date range or a lower outlier score."}
        </p>
      ) : null}

      <div
        className="harvy-outlier-masonry mt-5 flex gap-4"
        data-reflowing={isReflowing ? "true" : undefined}
      >
        {masonryColumns.map((column, columnIndex) => (
          <div key={columnIndex} className="harvy-outlier-masonry-col flex min-w-0 flex-1 flex-col gap-4">
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
