import { Search, Upload } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildUnsplashLoadAttrs, type HarvyImageLoadAttrs } from "./harvyImageAttribution";
import { MOCK_UNSPLASH_IMAGES } from "./harvyImageMockUnsplash";
import { searchUnsplashPhotos, listPopularUnsplashPhotos, type UnsplashImageResult } from "./unsplashSearch";
import { formatUnsplashSearchError, logUnsplashSearchFailure } from "./unsplashErrors";
import { UnsplashBrowseModal, type ExpandFromRect } from "./UnsplashBrowseModal";

type ImageSourceTab = "upload" | "link" | "unsplash" | "giphy";

const TABS: { id: ImageSourceTab; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "link", label: "Link" },
  { id: "unsplash", label: "Unsplash" },
  { id: "giphy", label: "GIPHY" },
];

export type HarvyImageSourcePopoverMode = "insert" | "replace";

type HarvyImageSourcePopoverProps = {
  mode?: HarvyImageSourcePopoverMode;
  anchorEl: HTMLElement;
  onClose: () => void;
  onSelectImage: (selection: string | HarvyImageLoadAttrs) => void;
  onUploadFile: () => Promise<string | null>;
};

const POPOVER_WIDTH = 360;
const VIEWPORT_PAD = 12;
const VERTICAL_GAP = 8;
const MAX_POPOVER_HEIGHT = 420;
const UNSPLASH_PREVIEW_COUNT = 6;

function isLikelyImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return /^https?:$/i.test(url.protocol);
  } catch {
    return false;
  }
}

/** Position the shared source menu relative to its anchor button. */
export function computeImageSourcePopoverPosition(
  anchorRect: DOMRect,
  panelWidth: number,
  mode: HarvyImageSourcePopoverMode,
): { top: number; left: number } {
  const width = Math.min(panelWidth, window.innerWidth - VIEWPORT_PAD * 2);
  const top = Math.min(anchorRect.bottom + VERTICAL_GAP, window.innerHeight - MAX_POPOVER_HEIGHT);

  let left: number;
  if (mode === "replace") {
    // Right edge of menu aligns with right edge of Replace button; menu extends left.
    left = anchorRect.right - width;
    left = Math.max(VIEWPORT_PAD, left);
    if (left + width > window.innerWidth - VIEWPORT_PAD) {
      left = window.innerWidth - VIEWPORT_PAD - width;
    }
  } else {
    // Insert: left edge of menu aligns with left edge of anchor (existing behavior).
    left = anchorRect.left;
    left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - width - VIEWPORT_PAD));
  }

  return { top, left };
}

export function HarvyImageSourcePopover({
  mode = "insert",
  anchorEl,
  onClose,
  onSelectImage,
  onUploadFile,
}: HarvyImageSourcePopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<ImageSourceTab>("upload");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [unsplashQuery, setUnsplashQuery] = useState("");
  const [unsplashResults, setUnsplashResults] = useState<UnsplashImageResult[]>([]);
  const [unsplashHasSearched, setUnsplashHasSearched] = useState(false);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashError, setUnsplashError] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseExpandFrom, setBrowseExpandFrom] = useState<ExpandFromRect | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popularLoadedRef = useRef(false);

  const loadPopularUnsplash = useCallback(async () => {
    setUnsplashLoading(true);
    setUnsplashError("");
    try {
      const results = await listPopularUnsplashPhotos({ perPage: 12 });
      setUnsplashResults(results.length > 0 ? results : MOCK_UNSPLASH_IMAGES);
      setUnsplashHasSearched(false);
      popularLoadedRef.current = true;
    } catch (error) {
      const message = formatUnsplashSearchError(error);
      logUnsplashSearchFailure(message);
      // Keep the curated samples if the popular feed is unavailable.
      setUnsplashResults(MOCK_UNSPLASH_IMAGES);
      setUnsplashHasSearched(false);
      setUnsplashError("");
      popularLoadedRef.current = false;
    } finally {
      setUnsplashLoading(false);
    }
  }, []);

  useEffect(() => {
    // Prefetch popular so Unsplash isn’t empty when the tab opens.
    void loadPopularUnsplash();
  }, [loadPopularUnsplash]);

  useEffect(() => {
    if (tab !== "unsplash") return;
    if (unsplashQuery.trim()) return;
    if (popularLoadedRef.current && unsplashResults.length > 0) return;
    void loadPopularUnsplash();
  }, [tab, unsplashQuery, unsplashResults.length, loadPopularUnsplash]);

  const updatePosition = useCallback(() => {
    const rect = anchorEl.getBoundingClientRect();
    const width = panelRef.current?.offsetWidth ?? POPOVER_WIDTH;
    setPosition(computeImageSourcePopoverPosition(rect, width, mode));
  }, [anchorEl, mode]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, tab]);

  useEffect(() => {
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (browseOpen) return;
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (browseOpen) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (anchorEl.contains(target)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [anchorEl, browseOpen, onClose]);

  const runUnsplashSearch = useCallback(async () => {
    const trimmed = unsplashQuery.trim();
    if (!trimmed) {
      setUnsplashError("");
      setUnsplashHasSearched(false);
      popularLoadedRef.current = false;
      void loadPopularUnsplash();
      return;
    }

    setUnsplashLoading(true);
    setUnsplashError("");
    setUnsplashResults([]);
    try {
      const results = await searchUnsplashPhotos(trimmed, { perPage: 12 });
      setUnsplashResults(results);
      setUnsplashHasSearched(true);
    } catch (error) {
      const message = formatUnsplashSearchError(error);
      logUnsplashSearchFailure(message);
      setUnsplashResults([]);
      setUnsplashHasSearched(true);
      setUnsplashError(message);
    } finally {
      setUnsplashLoading(false);
    }
  }, [unsplashQuery, loadPopularUnsplash]);

  const handleUpload = useCallback(async () => {
    setUploadBusy(true);
    try {
      const src = await onUploadFile();
      if (src) onSelectImage(src);
    } finally {
      setUploadBusy(false);
    }
  }, [onSelectImage, onUploadFile]);

  const handleEmbedLink = useCallback(() => {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      setLinkError("Enter an image URL.");
      return;
    }
    if (!isLikelyImageUrl(trimmed)) {
      setLinkError("Enter a valid http or https URL.");
      return;
    }
    setLinkError("");
    onSelectImage(trimmed);
  }, [linkUrl, onSelectImage]);

  const openBrowse = useCallback(() => {
    const rect = panelRef.current?.getBoundingClientRect();
    const expandFrom = rect
      ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      : null;
    // Defer so the "Show more" click doesn't land on the browse modal backdrop.
    window.setTimeout(() => {
      setBrowseExpandFrom(expandFrom);
      setBrowseOpen(true);
    }, 0);
  }, []);

  const previewResults = unsplashResults.slice(0, UNSPLASH_PREVIEW_COUNT);
  const canShowMore = !unsplashLoading && !unsplashError && unsplashResults.length > 0;

  return (
    <>
      {createPortal(
        <div
          ref={panelRef}
          className={`harvy-image-source-popover harvy-image-source-popover--anchor-${mode}`}
          style={{
            top: position.top,
            left: position.left,
            visibility: browseOpen ? "hidden" : "visible",
            pointerEvents: browseOpen ? "none" : undefined,
          }}
          data-anchor-mode={mode}
          role="dialog"
          aria-label={mode === "replace" ? "Replace image" : "Add image"}
          aria-hidden={browseOpen}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="harvy-image-source-popover__tabs" role="tablist" aria-label="Image source">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`harvy-image-source-popover__tab ${tab === t.id ? "harvy-image-source-popover__tab--active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="harvy-image-source-popover__body">
            {tab === "upload" ? (
              <div className="harvy-image-source-popover__upload">
                <button
                  type="button"
                  className="harvy-image-source-popover__upload-btn"
                  disabled={uploadBusy}
                  onClick={() => void handleUpload()}
                >
                  <Upload size={18} strokeWidth={1.65} aria-hidden />
                  <span>{uploadBusy ? "Opening picker…" : "Upload file"}</span>
                </button>
                <p className="harvy-image-source-popover__hint">Images are saved in your workspace.</p>
              </div>
            ) : null}

            {tab === "link" ? (
              <div className="harvy-image-source-popover__link">
                <input
                  type="url"
                  className="harvy-image-source-popover__input"
                  placeholder="Paste the image link..."
                  value={linkUrl}
                  onChange={(e) => {
                    setLinkUrl(e.target.value);
                    if (linkError) setLinkError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleEmbedLink();
                    }
                  }}
                />
                <button type="button" className="harvy-image-source-popover__primary" onClick={handleEmbedLink}>
                  Embed image
                </button>
                <p className="harvy-image-source-popover__hint">Works with any image from the web</p>
                {linkError ? <p className="harvy-image-source-popover__error">{linkError}</p> : null}
              </div>
            ) : null}

            {tab === "unsplash" ? (
              <div className="harvy-image-source-popover__unsplash">
                <div className="harvy-image-source-popover__search-row">
                  <input
                    type="search"
                    className="harvy-image-source-popover__input"
                    placeholder="Search for an image..."
                    value={unsplashQuery}
                    onChange={(e) => {
                      setUnsplashQuery(e.target.value);
                      if (unsplashError) setUnsplashError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void runUnsplashSearch();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="harvy-image-source-popover__search-btn"
                    aria-label="Search Unsplash"
                    disabled={unsplashLoading}
                    onClick={() => void runUnsplashSearch()}
                  >
                    <Search size={15} strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
                {unsplashError ? (
                  <p className="harvy-image-source-popover__error harvy-image-source-popover__error--banner">
                    {unsplashError}
                  </p>
                ) : null}
                <div className="harvy-image-source-popover__grid">
                  {unsplashLoading ? (
                    <p className="harvy-image-source-popover__status">Searching Unsplash…</p>
                  ) : unsplashError ? null : unsplashResults.length === 0 ? (
                    <p className="harvy-image-source-popover__empty">
                      {unsplashHasSearched ? "No images found for that search." : "No sample images to show."}
                    </p>
                  ) : (
                    <>
                      {previewResults.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          className="harvy-image-source-popover__thumb"
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
                          <img src={img.thumbUrl} alt={img.alt} loading="lazy" draggable={false} />
                          <span className="harvy-image-source-popover__credit">{img.photographer}</span>
                        </button>
                      ))}
                      {canShowMore ? (
                        <button
                          type="button"
                          className="harvy-image-source-popover__show-more"
                          onClick={openBrowse}
                        >
                          Show more
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {tab === "giphy" ? (
              <div className="harvy-image-source-popover__coming-soon">
                <p className="harvy-image-source-popover__coming-title">Coming soon</p>
                <p className="harvy-image-source-popover__hint">GIF search will be available in a future update.</p>
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      )}

      <UnsplashBrowseModal
        open={browseOpen}
        onClose={() => {
          setBrowseOpen(false);
          setBrowseExpandFrom(null);
        }}
        initialQuery={unsplashQuery}
        initialResults={unsplashResults}
        expandFrom={browseExpandFrom}
        onSelectImage={(selection) => {
          setBrowseOpen(false);
          setBrowseExpandFrom(null);
          onSelectImage(selection);
        }}
      />
    </>
  );
}
