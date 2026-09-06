import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Zap } from "lucide-react";
import type { HeadlinePair } from "../features/aiCheck/aiCheck";
import {
  closeHarvyContextMenu,
  findScrollableAncestors,
  HARVY_CONTEXT_MENU_DIVIDER_CLASS,
  HARVY_CONTEXT_MENU_ITEM_CLASS,
  HARVY_CONTEXT_MENU_ITEM_DISABLED_CLASS,
  placeHarvyContextMenuForElement,
} from "../features/editor/harvyContextMenu";
import { HarvyContextMenuShell } from "./HarvyContextMenu";

type HeadlineSuggestMenuProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  mountEl: HTMLElement | null;
  running: boolean;
  runningFromHeadlines?: boolean;
  error: string | null;
  pairs: HeadlinePair[];
  selectedIndex: number | null;
  onGenerate: () => void;
  onGenerateFromHeadlines?: () => void;
  onSelectPair: (pair: HeadlinePair, index: number) => void;
  onClose: () => void;
};

export function HeadlineSuggestMenu({
  open,
  anchorEl,
  mountEl,
  running,
  runningFromHeadlines = false,
  error,
  pairs,
  selectedIndex,
  onGenerate,
  onGenerateFromHeadlines,
  onSelectPair,
  onClose,
}: HeadlineSuggestMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    closeHarvyContextMenu();
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !anchorEl || !mountEl || !menuRef.current) return;
    placeHarvyContextMenuForElement(menuRef.current, mountEl, anchorEl);
  }, [open, anchorEl, mountEl, running, runningFromHeadlines, error, pairs]);

  useEffect(() => {
    if (!open || !anchorEl || !mountEl) return;

    const reposition = () => {
      if (!menuRef.current) return;
      placeHarvyContextMenuForElement(menuRef.current, mountEl, anchorEl);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      onClose();
    };
    const onInput = () => onClose();

    const scrollEls = [mountEl, ...findScrollableAncestors(mountEl)];
    for (const scrollEl of scrollEls) {
      scrollEl.addEventListener("scroll", reposition, { passive: true });
    }
    window.addEventListener("resize", reposition);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    anchorEl.addEventListener("input", onInput);

    return () => {
      for (const scrollEl of scrollEls) {
        scrollEl.removeEventListener("scroll", reposition);
      }
      window.removeEventListener("resize", reposition);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown, true);
      anchorEl.removeEventListener("input", onInput);
    };
  }, [open, anchorEl, mountEl, onClose]);

  if (!open || !mountEl) return null;

  return createPortal(
    <HarvyContextMenuShell
      menuRef={menuRef}
      ariaLabel="Suggest titles"
      className="harvy-context-menu--headlines"
    >
      <button
        type="button"
        role="menuitem"
        disabled={running}
        className={running ? HARVY_CONTEXT_MENU_ITEM_DISABLED_CLASS : HARVY_CONTEXT_MENU_ITEM_CLASS}
        onPointerDown={(event) => {
          if (event.button !== 0 || running) return;
          event.preventDefault();
          event.stopPropagation();
          onGenerate();
        }}
      >
        <span className="flex items-center gap-1.5">
          <Zap size={14} strokeWidth={2} aria-hidden className="shrink-0" />
          {running && !runningFromHeadlines ? "Suggesting..." : "Suggest titles"}
        </span>
      </button>
      {onGenerateFromHeadlines ? (
        <button
          type="button"
          role="menuitem"
          disabled={running}
          className={running ? HARVY_CONTEXT_MENU_ITEM_DISABLED_CLASS : HARVY_CONTEXT_MENU_ITEM_CLASS}
          onPointerDown={(event) => {
            if (event.button !== 0 || running) return;
            event.preventDefault();
            event.stopPropagation();
            onGenerateFromHeadlines();
          }}
        >
          <span className="flex items-center gap-1.5">
            <Zap size={14} strokeWidth={2} aria-hidden className="shrink-0" />
            {running && runningFromHeadlines
              ? "Suggesting..."
              : "Suggest Titles from 'Headlines'"}
          </span>
        </button>
      ) : null}
      {error ? (
        <p className="harvy-context-menu__note harvy-context-menu__note--left" role="alert">
          {error}
        </p>
      ) : null}
      {pairs.length > 0 ? (
        <>
          <div className={HARVY_CONTEXT_MENU_DIVIDER_CLASS} aria-hidden />
          {pairs.map((pair, index) => {
            const selected = selectedIndex === index;
            return (
              <button
                key={`${index}-${pair.title}`}
                type="button"
                role="menuitem"
                aria-pressed={selected}
                className={`${HARVY_CONTEXT_MENU_ITEM_CLASS}${
                  selected ? " harvy-context-menu-item--selected" : ""
                }`}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  onSelectPair(pair, index);
                }}
              >
                <span className="block">{pair.title}</span>
                {pair.subtitle ? (
                  <span className="harvy-context-menu-item__kicker">{pair.subtitle}</span>
                ) : null}
              </button>
            );
          })}
        </>
      ) : null}
    </HarvyContextMenuShell>,
    mountEl,
  );
}
