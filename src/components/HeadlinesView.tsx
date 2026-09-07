import { Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  HARVY_SIDEBAR_IMAGE_DROP_EVENT,
  isSidebarImageDragActive,
  type SidebarImageDropDetail,
} from "../features/editor/imageDrop";
import {
  deleteHeadlineScreenshotFile,
  imageFilesFromClipboard,
  importHeadlineScreenshotFiles,
  importHeadlineScreenshotsFromDataTransfer,
  importHeadlineScreenshotsFromPaths,
  imagePathsFromFiles,
  pickAndImportHeadlineScreenshots,
  resolveHeadlineShotSrc,
  transferLooksLikeFiles,
} from "../features/headlines/headlineScreenshotAssets";
import {
  loadHeadlineShots,
  saveHeadlineShots,
  type HeadlineShot,
} from "../features/headlines/headlineShots";
import { isTauriRuntime } from "../features/save/saveRuntime";
import { useOutlierColumnCount } from "../features/outliers/useOutlierColumnCount";
import { CenteredOverlayModal } from "./overlay/CenteredOverlayModal";

const ADD_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-md text-accent/65 transition-colors hover:bg-white/[0.06] hover:text-accent dark:hover:text-accent";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("textarea, input, [contenteditable='true']"));
}

function isOverHeadlinesPage(clientX: number, clientY: number): boolean {
  const el = document.elementFromPoint(clientX, clientY);
  return Boolean(el?.closest("#harvy-editor-panel"));
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
  const dropInFlightRef = useRef(false);
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

  const importIncoming = useCallback(
    async (incoming: Promise<HeadlineShot[]>) => {
      if (dropInFlightRef.current) return;
      dropInFlightRef.current = true;
      try {
        addShots(await incoming);
      } finally {
        dropInFlightRef.current = false;
        setIsDragging(false);
      }
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

  useEffect(() => {
    const onDragOver = (event: DragEvent) => {
      if (!transferLooksLikeFiles(event.dataTransfer) && !isSidebarImageDragActive()) return;
      if (!isOverHeadlinesPage(event.clientX, event.clientY)) {
        setIsDragging(false);
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setIsDragging(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget) return;
      setIsDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!isOverHeadlinesPage(event.clientX, event.clientY)) {
        setIsDragging(false);
        return;
      }
      if (!event.dataTransfer) return;
      event.preventDefault();
      if (isTauriRuntime() && imagePathsFromFiles(event.dataTransfer.files).length === 0) {
        // OS file drops are handled by Tauri's drag-drop event.
        return;
      }
      void importIncoming(importHeadlineScreenshotsFromDataTransfer(event.dataTransfer));
    };
    const onDragEnd = () => setIsDragging(false);

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, [importIncoming]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!isSidebarImageDragActive()) return;
      setIsDragging(isOverHeadlinesPage(event.clientX, event.clientY));
    };
    const onSidebarDrop = (event: Event) => {
      const detail = (event as CustomEvent<SidebarImageDropDetail>).detail;
      if (!detail?.path) return;
      if (!isOverHeadlinesPage(detail.clientX, detail.clientY)) {
        setIsDragging(false);
        return;
      }
      void importIncoming(importHeadlineScreenshotsFromPaths([detail.path]));
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener(HARVY_SIDEBAR_IMAGE_DROP_EVENT, onSidebarDrop);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener(HARVY_SIDEBAR_IMAGE_DROP_EVENT, onSidebarDrop);
    };
  }, [importIncoming]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onDragDropEvent((event) => {
        if (cancelled) return;
        if (event.payload.type === "leave") {
          setIsDragging(false);
          return;
        }

        void (async () => {
          const scale = await getCurrentWindow().scaleFactor();
          if (cancelled) return;
          const position =
            event.payload.type === "enter" ||
            event.payload.type === "over" ||
            event.payload.type === "drop"
              ? event.payload.position
              : null;
          if (!position) return;
          const clientX = position.x / scale;
          const clientY = position.y / scale;
          const over = isOverHeadlinesPage(clientX, clientY);

          if (event.payload.type === "enter" || event.payload.type === "over") {
            setIsDragging(over);
            return;
          }
          if (event.payload.type !== "drop") return;
          setIsDragging(false);
          if (!over || event.payload.paths.length === 0) return;
          void importIncoming(importHeadlineScreenshotsFromPaths(event.payload.paths));
        })();
      })
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [importIncoming]);

  const activeSrc = activeShot ? resolveHeadlineShotSrc(activeShot.src) : "";

  return (
    <div
      className={`relative mt-7 flex min-h-0 flex-1 flex-col ${
        isDragging ? "rounded-xl ring-1 ring-accent/35 ring-offset-0" : ""
      }`}
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
