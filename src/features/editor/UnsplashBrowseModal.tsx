import { Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildUnsplashLoadAttrs, type HarvyImageLoadAttrs } from "./harvyImageAttribution";
import { MOCK_UNSPLASH_IMAGES } from "./harvyImageMockUnsplash";
import { formatUnsplashSearchError, logUnsplashSearchFailure } from "./unsplashErrors";
import { searchUnsplashPhotos, listPopularUnsplashPhotos, type UnsplashImageResult } from "./unsplashSearch";

const BROWSE_PER_PAGE = 30;
const EXPAND_MS = 280;

export type ExpandFromRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type UnsplashBrowseModalProps = {
  open: boolean;
  onClose: () => void;
  /** Prefill search from the compact Unsplash popover. */
  initialQuery?: string;
  /** Seed grid while the first search loads (e.g. popover results). */
  initialResults?: UnsplashImageResult[];
  /** Screen rect of the small popover to animate from. */
  expandFrom?: ExpandFromRect | null;
  onSelectImage: (selection: HarvyImageLoadAttrs) => void;
};

function mergeUniqueResults(
  current: UnsplashImageResult[],
  incoming: UnsplashImageResult[],
): UnsplashImageResult[] {
  const seen = new Set(current.map((item) => item.id));
  const next = [...current];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }
  return next;
}

export function UnsplashBrowseModal({
  open,
  onClose,
  initialQuery = "",
  initialResults,
  expandFrom = null,
  onSelectImage,
}: UnsplashBrowseModalProps) {
  const searchId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<UnsplashImageResult[]>(
    initialResults?.length ? initialResults : MOCK_UNSPLASH_IMAGES,
  );
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(!expandFrom);
  /** Ignore backdrop dismiss until the opening click finishes (and expand animates). */
  const [dismissReady, setDismissReady] = useState(false);

  const runSearch = useCallback(async (rawQuery: string, nextPage: number, append: boolean) => {
    const trimmed = rawQuery.trim();
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");

    try {
      const pageResults = trimmed
        ? await searchUnsplashPhotos(trimmed, {
            page: nextPage,
            perPage: BROWSE_PER_PAGE,
          })
        : await listPopularUnsplashPhotos({
            page: nextPage,
            perPage: BROWSE_PER_PAGE,
          });
      setPage(nextPage);
      setHasMore(pageResults.length >= BROWSE_PER_PAGE);
      setResults((prev) => (append ? mergeUniqueResults(prev, pageResults) : pageResults));
    } catch (err) {
      const message = formatUnsplashSearchError(err);
      logUnsplashSearchFailure(message);
      setError(message);
      if (!append) setResults([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setDismissReady(false);
      return;
    }
    const seedQuery = initialQuery.trim();
    const seedResults = initialResults?.length ? initialResults : MOCK_UNSPLASH_IMAGES;
    setQuery(seedQuery);
    setResults(seedResults);
    setPage(1);
    setHasMore(true);
    setError("");
    setExpanded(!expandFrom);
    setDismissReady(false);
    void runSearch(seedQuery, 1, false);
    // Block the opening click from dismissing via the backdrop.
    const readyTimer = window.setTimeout(
      () => setDismissReady(true),
      expandFrom ? EXPAND_MS + 80 : 120,
    );
    return () => window.clearTimeout(readyTimer);
    // Intentionally only re-seed when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-only bootstrap
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !expandFrom || !panelRef.current) return;

    const panel = panelRef.current;
    const final = panel.getBoundingClientRect();
    if (final.width < 1 || final.height < 1) return;

    const scaleX = expandFrom.width / final.width;
    const scaleY = expandFrom.height / final.height;
    const originX = expandFrom.left + expandFrom.width / 2;
    const originY = expandFrom.top + expandFrom.height / 2;
    const finalCX = final.left + final.width / 2;
    const finalCY = final.top + final.height / 2;
    const dx = originX - finalCX;
    const dy = originY - finalCY;

    panel.style.transformOrigin = "center center";
    panel.style.transition = "none";
    panel.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`;
    panel.style.opacity = "1";

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        panel.style.transition = `transform ${EXPAND_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${EXPAND_MS}ms ease-out`;
        panel.style.transform = "translate(0px, 0px) scale(1, 1)";
        setExpanded(true);
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [open, expandFrom]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Let the search field handle Esc clear first when it has text.
      const target = e.target;
      if (
        target instanceof HTMLInputElement &&
        panelRef.current?.contains(target) &&
        target.value.length > 0
      ) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  const dismissIfReady = () => {
    if (!dismissReady) return;
    onCloseRef.current();
  };

  useEffect(() => {
    if (!open || !dismissReady) return;
    const input = searchInputRef.current;
    if (!input) return;
    // Focus after the opening click settles so typing goes to search, not the editor.
    const frame = window.requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
      if (input.value) input.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, dismissReady]);

  const handleSearch = () => {
    void runSearch(query.trim(), 1, false);
  };

  const handleLoadMore = () => {
    if (loading || loadingMore || !hasMore) return;
    void runSearch(query.trim(), page + 1, true);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-6" role="presentation">
      <button
        type="button"
        tabIndex={-1}
        className={`absolute inset-0 bg-ink/[0.22] backdrop-blur-[1px] transition-opacity duration-200 ${
          dismissReady ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{ opacity: expanded ? 1 : 0 }}
        aria-label="Dismiss Unsplash browser"
        onClick={dismissIfReady}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="harvy-unsplash-browse-title"
        className="relative z-[1] flex h-[min(760px,90vh)] w-[min(980px,94vw)] max-h-[90vh] max-w-[94vw] min-h-0 flex-col overflow-hidden rounded-xl bg-page shadow-[0_24px_64px_-20px_rgba(28,25,23,0.16)] dark:shadow-[0_28px_80px_-24px_rgba(0,0,0,0.55)]"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 px-6 py-3.5">
          <div className="min-w-0">
            <h1
              id="harvy-unsplash-browse-title"
              className="text-[15px] font-semibold tracking-tight text-ink"
            >
              Unsplash
            </h1>
            <p className="mt-1 text-[12px] font-normal text-muted/65 dark:text-white/45">
              Browse a larger selection of photos
            </p>
          </div>
          <button
            type="button"
            aria-label="Close Unsplash browser"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
            onClick={() => onCloseRef.current()}
          >
            <X size={18} strokeWidth={1.5} aria-hidden />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 pb-5 pt-2">
          <div className="flex shrink-0 gap-2">
            <label className="sr-only" htmlFor={searchId}>
              Search Unsplash
            </label>
            <input
              ref={searchInputRef}
              id={searchId}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              onKeyUp={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder="Search for an image…"
              className="h-10 min-w-0 flex-1 rounded-lg border-0 bg-canvas/45 px-3 text-[13px] text-ink outline-none ring-1 ring-line/20 placeholder:text-muted/45 focus:ring-ink/20 dark:bg-canvas/35"
            />
            <button
              type="button"
              aria-label="Search Unsplash"
              disabled={loading}
              onClick={handleSearch}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/[0.06] text-ink transition-colors hover:bg-ink/[0.1] disabled:opacity-50 dark:bg-ink/[0.1]"
            >
              <Search size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </div>

          {error ? (
            <p className="shrink-0 text-[12px] leading-snug text-[#e5484d]">{error}</p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {loading && results.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted/70">Searching Unsplash…</p>
            ) : results.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted/70">
                No images found for that search.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {results.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      className="group flex flex-col gap-1.5 rounded-lg text-left outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ink/25"
                      onClick={() =>
                        onSelectImage(
                          buildUnsplashLoadAttrs(img.fullUrl, {
                            photographerName: img.photographer,
                            photographerUrl: img.photographerUrl,
                            unsplashUrl: img.unsplashUrl,
                          }),
                        )
                      }
                    >
                      <img
                        src={img.thumbUrl}
                        alt={img.alt}
                        loading="lazy"
                        draggable={false}
                        className="aspect-[4/3] w-full rounded-md object-cover bg-ink/[0.04]"
                      />
                      <span className="truncate text-[12px] leading-snug text-muted/75">
                        {img.photographer}
                      </span>
                    </button>
                  ))}
                </div>
                {hasMore ? (
                  <div className="mt-4 flex justify-center pb-2">
                    <button
                      type="button"
                      disabled={loading || loadingMore}
                      onClick={handleLoadMore}
                      className="rounded-lg bg-ink/[0.06] px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-ink/[0.1] disabled:opacity-50 dark:bg-ink/[0.1]"
                    >
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
