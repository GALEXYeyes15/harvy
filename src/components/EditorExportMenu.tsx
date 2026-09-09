import { SquareArrowOutUpRight, Upload, Zap } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HARVY_CONTEXT_MENU_ITEM_CLASS,
  HARVY_CONTEXT_MENU_ITEM_DISABLED_CLASS,
} from "../features/editor/harvyContextMenu";
import { HarvyContextMenuShell } from "./HarvyContextMenu";

const ICON_SIZE = 19;
const ICON_STROKE = 1.5;
const MORE_CLOSE_DELAY_MS = 160;

const ICON_BTN =
  "pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-accent transition-[opacity,background-color,color] duration-200 hover:bg-accent/10 hover:text-accent";

type EditorExportMenuProps = {
  onCopyDocument: () => Promise<boolean>;
  onPublish?: () => void | Promise<void>;
  publishEnabled?: boolean;
  onPodcastNotesPdf: () => void | Promise<void>;
  onPrint: () => void | Promise<void>;
  podcastNotesEnabled?: boolean;
  podcastNotesRunning?: boolean;
};

function placeExportMenu(menuEl: HTMLElement, anchorEl: HTMLElement): void {
  const anchor = anchorEl.getBoundingClientRect();
  const menu = menuEl.getBoundingClientRect();
  const gap = 8;
  const margin = 8;

  let left = anchor.right + gap;
  let top = anchor.top - menu.height - gap;

  left = Math.min(left, window.innerWidth - menu.width - margin);
  left = Math.max(margin, left);
  top = Math.max(margin, top);
  top = Math.min(top, window.innerHeight - menu.height - margin);

  menuEl.style.position = "fixed";
  menuEl.style.left = `${left}px`;
  menuEl.style.top = `${top}px`;
  menuEl.style.zIndex = "10000";
}

function placeExportSubmenu(
  submenuEl: HTMLElement,
  parentMenuEl: HTMLElement,
  itemEl: HTMLElement,
): void {
  const parent = parentMenuEl.getBoundingClientRect();
  const item = itemEl.getBoundingClientRect();
  const menu = submenuEl.getBoundingClientRect();
  const overlap = 8;
  const margin = 8;

  let left = parent.right - overlap;
  if (left + menu.width > window.innerWidth - margin) {
    left = parent.left - menu.width + overlap;
  }
  left = Math.max(margin, left);

  let top = item.top;
  top = Math.min(top, window.innerHeight - menu.height - margin);
  top = Math.max(margin, top);

  submenuEl.style.position = "fixed";
  submenuEl.style.left = `${left}px`;
  submenuEl.style.top = `${top}px`;
  submenuEl.style.zIndex = "10001";
}

export function EditorExportMenu({
  onCopyDocument,
  onPublish,
  publishEnabled = false,
  onPodcastNotesPdf,
  onPrint,
  podcastNotesEnabled = false,
  podcastNotesRunning = false,
}: EditorExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreItemRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const moreCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeMenu = useCallback(() => {
    if (moreCloseTimerRef.current) {
      clearTimeout(moreCloseTimerRef.current);
      moreCloseTimerRef.current = null;
    }
    setMoreOpen(false);
    setOpen(false);
  }, []);

  const clearMoreCloseTimer = useCallback(() => {
    if (moreCloseTimerRef.current) {
      clearTimeout(moreCloseTimerRef.current);
      moreCloseTimerRef.current = null;
    }
  }, []);

  const openMore = useCallback(() => {
    clearMoreCloseTimer();
    setMoreOpen(true);
  }, [clearMoreCloseTimer]);

  const scheduleCloseMore = useCallback(() => {
    clearMoreCloseTimer();
    moreCloseTimerRef.current = setTimeout(() => {
      moreCloseTimerRef.current = null;
      setMoreOpen(false);
    }, MORE_CLOSE_DELAY_MS);
  }, [clearMoreCloseTimer]);

  const runAction = useCallback(
    (action: () => void | Promise<void>) => {
      const result = action();
      closeMenu();
      void result;
    },
    [closeMenu],
  );

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;
    placeExportMenu(menuRef.current, buttonRef.current);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !moreOpen || !menuRef.current || !moreItemRef.current || !submenuRef.current) {
      return;
    }
    placeExportSubmenu(submenuRef.current, menuRef.current, moreItemRef.current);
  }, [open, moreOpen]);

  useEffect(() => {
    if (!open) setMoreOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (moreOpen) {
        setMoreOpen(false);
        return;
      }
      closeMenu();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      if (submenuRef.current?.contains(target)) return;
      closeMenu();
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, moreOpen, closeMenu]);

  useEffect(() => {
    return () => {
      if (moreCloseTimerRef.current) clearTimeout(moreCloseTimerRef.current);
    };
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={ICON_BTN}
        aria-label="Export"
        title="Export"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Upload size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
      {open
        ? createPortal(
            <HarvyContextMenuShell
              menuRef={menuRef}
              ariaLabel="Export"
              onMouseDown={(event) => event.preventDefault()}
            >
              <button
                type="button"
                role="menuitem"
                className={HARVY_CONTEXT_MENU_ITEM_CLASS}
                onClick={() =>
                  runAction(async () => {
                    await onCopyDocument();
                  })
                }
              >
                Copy
              </button>
              <button
                type="button"
                role="menuitem"
                className={HARVY_CONTEXT_MENU_ITEM_CLASS}
                onClick={() => runAction(onPrint)}
              >
                Print…
              </button>
              <div
                className="relative"
                onPointerEnter={openMore}
                onPointerLeave={scheduleCloseMore}
              >
                <button
                  ref={moreItemRef}
                  type="button"
                  role="menuitem"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                  className={`${HARVY_CONTEXT_MENU_ITEM_CLASS}${
                    moreOpen ? " harvy-context-menu-item--open" : ""
                  }`}
                  onClick={openMore}
                >
                  More…
                </button>
                {moreOpen ? (
                  <div ref={submenuRef} className="absolute left-full top-0 z-[1]">
                    <HarvyContextMenuShell
                      ariaLabel="More"
                      className="harvy-export-submenu"
                      onMouseDown={(event) => event.preventDefault()}
                    >
                    <button
                      type="button"
                      role="menuitem"
                      className={`${
                        publishEnabled && onPublish
                          ? HARVY_CONTEXT_MENU_ITEM_CLASS
                          : HARVY_CONTEXT_MENU_ITEM_DISABLED_CLASS
                      } harvy-context-menu-item--with-icon`}
                      disabled={!publishEnabled || !onPublish}
                      title={
                        publishEnabled
                          ? "Copy the post and open your publish link in the browser"
                          : "Add a publish link in Settings → Export"
                      }
                      onClick={() => {
                        if (!publishEnabled || !onPublish) return;
                        runAction(onPublish);
                      }}
                    >
                      <span className="min-w-0 flex-1">Copy + Publish</span>
                      <SquareArrowOutUpRight
                        size={14}
                        strokeWidth={2}
                        aria-hidden
                        className="shrink-0"
                      />
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={`${
                        !podcastNotesEnabled || podcastNotesRunning
                          ? HARVY_CONTEXT_MENU_ITEM_DISABLED_CLASS
                          : HARVY_CONTEXT_MENU_ITEM_CLASS
                      } harvy-context-menu-item--with-icon`}
                      disabled={!podcastNotesEnabled || podcastNotesRunning}
                      title={
                        podcastNotesEnabled
                          ? "Generate podcast notes with your AI check model, then export a PDF"
                          : "Enable AI check and add an API key in Settings to use podcast notes"
                      }
                      onClick={() => {
                        if (!podcastNotesEnabled || podcastNotesRunning) return;
                        runAction(onPodcastNotesPdf);
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        {podcastNotesRunning ? "Export Podcast Notes…" : "Export Podcast Notes"}
                      </span>
                      <Zap size={14} strokeWidth={2} aria-hidden className="shrink-0" />
                    </button>
                    </HarvyContextMenuShell>
                  </div>
                ) : null}
              </div>
            </HarvyContextMenuShell>,
            document.body,
          )
        : null}
    </>
  );
}
