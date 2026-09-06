import { Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteHeadlineScreenshotFile,
  imageFilesFromClipboard,
  imageFilesFromDataTransfer,
  importHeadlineScreenshotFiles,
  pickAndImportHeadlineScreenshots,
  resolveHeadlineShotSrc,
  transferLooksLikeFiles,
} from "../features/headlines/headlineScreenshotAssets";
import {
  loadHeadlineShots,
  saveHeadlineShots,
  type HeadlineShot,
} from "../features/headlines/headlineShots";
import { useOutlierColumnCount } from "../features/outliers/useOutlierColumnCount";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

const ADD_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-md text-accent/65 transition-colors hover:bg-white/[0.06] hover:text-accent dark:hover:text-accent";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("textarea, input, [contenteditable='true']"));
}

function HeadlineShotCard({
  shot,
  onOpen,
  onDelete,
}: {
  shot: HeadlineShot;
  onOpen: (shot: HeadlineShot) => void;
  onDelete: (shot: HeadlineShot) => void;
}) {
  const src = resolveHeadlineShotSrc(shot.src);

  return (
    <article className="harvy-outlier-card harvy-headline-card group relative overflow-hidden p-0">
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => onOpen(shot)}
        aria-label="Open headline screenshot"
      >
        {src ? (
          <img src={src} alt="" className="block w-full" draggable={false} />
        ) : (
          <div className="flex aspect-[4/3] items-center justify-center text-[12px] text-muted/60">
            Missing image
          </div>
        )}
      </button>
      <button
        type="button"
        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-stage/80 text-muted/70 opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:bg-stage hover:text-ink group-hover:opacity-100 group-focus-within:opacity-100"
        aria-label="Delete screenshot"
        title="Delete"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(shot);
        }}
      >
        <Trash2 size={14} strokeWidth={1.75} aria-hidden />
      </button>
    </article>
  );
}

export function HeadlinesView({
  workspaceSidebarOpen = true,
  toolsSidebarOpen = true,
}: {
  workspaceSidebarOpen?: boolean;
  toolsSidebarOpen?: boolean;
}) {
  const [shots, setShots] = useState<HeadlineShot[]>(() => loadHeadlineShots());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeShot, setActiveShot] = useState<HeadlineShot | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);
  const { columnCount, isReflowing } = useOutlierColumnCount({
    workspaceSidebarOpen,
    toolsSidebarOpen,
  });

  const addShots = useCallback((incoming: HeadlineShot[]) => {
    if (incoming.length === 0) return;
    setShots((current) => {
      const next = [...incoming, ...current];
      saveHeadlineShots(next);
      return next;
    });
  }, []);

  const handleAdd = useCallback(async () => {
    addShots(await pickAndImportHeadlineScreenshots());
  }, [addShots]);

  const handleDelete = useCallback(
    (shot: HeadlineShot) => {
      void deleteHeadlineScreenshotFile(shot.src);
      setShots((current) => {
        const next = current.filter((item) => item.id !== shot.id);
        saveHeadlineShots(next);
        return next;
      });
      if (activeShot?.id === shot.id) setActiveShot(null);
    },
    [activeShot],
  );

  const handleDropFiles = useCallback(
    async (files: File[]) => {
      addShots(await importHeadlineScreenshotFiles(files));
    },
    [addShots],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const files = imageFilesFromClipboard(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      void handleDropFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleDropFiles]);

  const activeSrc = activeShot ? resolveHeadlineShotSrc(activeShot.src) : "";

  return (
    <div
      className={`relative mt-7 min-h-0 flex-1 ${
        isDragging ? "rounded-xl ring-1 ring-accent/35 ring-offset-0" : ""
      }`}
      onDragEnter={(event) => {
        if (!transferLooksLikeFiles(event.dataTransfer)) return;
        event.preventDefault();
        dragDepthRef.current += 1;
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        if (!transferLooksLikeFiles(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setIsDragging(false);
      }}
      onDrop={(event) => {
        const files = imageFilesFromDataTransfer(event.dataTransfer);
        event.preventDefault();
        dragDepthRef.current = 0;
        setIsDragging(false);
        if (files.length === 0) return;
        void handleDropFiles(files);
      }}
    >
      <div className="harvy-outlier-search-bar w-full">
        <Search
          size={15}
          strokeWidth={1.75}
          aria-hidden
          className="harvy-outlier-search-icon shrink-0"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search headlines…"
          className="harvy-outlier-search-input min-w-0 flex-1"
          aria-label="Search headlines"
        />
        <div className="harvy-outlier-search-actions shrink-0">
          <button
            type="button"
            aria-label="Add screenshot"
            title="Add screenshot"
            className={ADD_BUTTON}
            onClick={() => void handleAdd()}
          >
            <Plus size={15} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      {shots.length === 0 ? (
        <p className="mt-5 text-[13px] text-muted/65">Add a screenshot with +.</p>
      ) : (
        <div
          className="harvy-headline-masonry mt-5"
          data-reflowing={isReflowing ? "true" : undefined}
          style={{ columnCount }}
        >
          {shots.map((shot) => (
            <HeadlineShotCard
              key={shot.id}
              shot={shot}
              onOpen={setActiveShot}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <CenteredOverlayModal
        open={activeShot !== null}
        onClose={() => setActiveShot(null)}
        title="Headline screenshot"
        titleId="harvy-headline-preview-title"
        titleClassName="sr-only"
        backdropLabel="Close headline screenshot"
        closeLabel="Close headline screenshot"
        panelSizeClassName="max-h-[min(88vh,calc(100vh-2.5rem))] w-full max-w-[min(1040px,calc(100vw-2.5rem))]"
        bodyClassName="flex min-h-0 flex-1 items-center justify-center overflow-auto px-6 pb-6 pt-1"
      >
        {activeSrc ? (
          <img
            src={activeSrc}
            alt=""
            className="max-h-[min(72vh,calc(100vh-10rem))] max-w-full object-contain"
            draggable={false}
          />
        ) : (
          <p className="text-[14px] text-muted/75">Could not preview this image.</p>
        )}
      </CenteredOverlayModal>
    </div>
  );
}
