import { SquareArrowOutUpRight, Upload, Zap } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  HARVY_CONTEXT_MENU_DIVIDER_CLASS,
  HARVY_CONTEXT_MENU_ITEM_CLASS,
  HARVY_CONTEXT_MENU_ITEM_DISABLED_CLASS,
} from "../features/editor/harvyContextMenu";
import { HarvyContextMenuShell } from "./HarvyContextMenu";

const ICON_SIZE = 19;
const ICON_STROKE = 1.5;

const ICON_BTN =
  "pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-accent transition-[opacity,background-color,color] duration-200 hover:bg-accent/10 hover:text-accent";

type EditorExportMenuProps = {
  onCopyDocument: () => Promise<boolean>;
  onPublish?: () => void | Promise<void>;
  publishEnabled?: boolean;
  onPodcastNotesPdf: () => void | Promise<void>;
  onSaveAsPdf: () => void | Promise<void>;
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

export function EditorExportMenu({
  onCopyDocument,
  onPublish,
  publishEnabled = false,
  onPodcastNotesPdf,
  onSaveAsPdf,
  onPrint,
  podcastNotesEnabled = false,
  podcastNotesRunning = false,
}: EditorExportMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  const runAction = useCallback(
    (action: () => void | Promise<void>) => {
      closeMenu();
      void action();
    },
    [closeMenu],
  );

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;
    placeExportMenu(menuRef.current, buttonRef.current);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, closeMenu]);

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
                onClick={() => runAction(onSaveAsPdf)}
              >
                Save as PDF
              </button>
              <button
                type="button"
                role="menuitem"
                className={HARVY_CONTEXT_MENU_ITEM_CLASS}
                onClick={() => runAction(onPrint)}
              >
                Print
              </button>
              <div className={HARVY_CONTEXT_MENU_DIVIDER_CLASS} role="separator" />
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
                <SquareArrowOutUpRight size={14} strokeWidth={2} aria-hidden className="shrink-0" />
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
            </HarvyContextMenuShell>,
            document.body,
          )
        : null}
    </>
  );
}
