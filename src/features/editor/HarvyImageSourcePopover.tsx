import { Upload } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildUnsplashLoadAttrs, type HarvyImageLoadAttrs } from "./harvyImageAttribution";
import { MOCK_UNSPLASH_IMAGES, searchMockUnsplash, type MockUnsplashImage } from "./harvyImageMockUnsplash";

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
  const [unsplashResults, setUnsplashResults] = useState<MockUnsplashImage[]>(MOCK_UNSPLASH_IMAGES);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

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
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
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
  }, [anchorEl, onClose]);

  useEffect(() => {
    setUnsplashResults(searchMockUnsplash(unsplashQuery));
  }, [unsplashQuery]);

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

  return createPortal(
    <div
      ref={panelRef}
      className={`harvy-image-source-popover harvy-image-source-popover--anchor-${mode}`}
      style={{ top: position.top, left: position.left }}
      data-anchor-mode={mode}
      role="dialog"
      aria-label={mode === "replace" ? "Replace image" : "Add image"}
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
            <input
              type="search"
              className="harvy-image-source-popover__input"
              placeholder="Search for an image..."
              value={unsplashQuery}
              onChange={(e) => setUnsplashQuery(e.target.value)}
            />
            <div className="harvy-image-source-popover__grid">
              {unsplashResults.length === 0 ? (
                <p className="harvy-image-source-popover__empty">No sample images match that search.</p>
              ) : (
                unsplashResults.map((img) => (
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
                ))
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
  );
}
