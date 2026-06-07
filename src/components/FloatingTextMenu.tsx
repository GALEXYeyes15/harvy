import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  MessageSquare,
  Underline,
} from "lucide-react";
import type { EditorCommand } from "../features/editor/commands";
import type { LinkFormatOptions } from "../features/editor/editorFormatActions";
import { isTextFormattingSelection } from "../features/editor/floatingTextMenuSelection";
import { getEditorSelectionViewportRect } from "../features/editor/tiptapSelectionRect";

/** Wait this long after the last selection change (and after pointer release) before showing the menu. */
const STABLE_SELECTION_MS = 100;

const MENU_FADE_IN_MS = 500;
const MENU_FADE_OUT_MS = 250;

/** Horizontal gap between selection highlight and toolbar (toolbar left = selection right + gap). */
const TOOLBAR_SELECTION_H_GAP = 8;

const BTN =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#eaeaea] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white";
const BTN_ACTIVE = "bg-[rgba(255,255,255,0.14)] text-white";

type FloatingTextMenuProps = {
  editor: Editor | null;
  isEditable: boolean;
  onApplyFormat: (command: EditorCommand, opts?: LinkFormatOptions) => void;
};

type Anchor = { selectionRight: number; selectionBottom: number; selectionTop: number };

function getScrollableAncestors(el: HTMLElement | null): HTMLElement[] {
  const out: HTMLElement[] = [];
  let n: HTMLElement | null = el;
  while (n) {
    const { overflowY } = getComputedStyle(n);
    if (overflowY === "auto" || overflowY === "scroll") out.push(n);
    n = n.parentElement;
  }
  return out;
}

export function FloatingTextMenu({ editor, isEditable, onApplyFormat }: FloatingTextMenuProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  /** Stays mounted while fading out so opacity can animate; mirrors `anchor` plus exit lag. */
  const [panelAnchor, setPanelAnchor] = useState<Anchor | null>(null);
  const [menuOpacityOn, setMenuOpacityOn] = useState(false);
  const [tick, setTick] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [commentNote, setCommentNote] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const revealTimerRef = useRef<number | null>(null);
  const fadeOutTimerRef = useRef<number | null>(null);
  /** True while the user has a pointer down on the editor (drag-select in progress). */
  const pointerSelectingRef = useRef(false);
  const anchorVisibleRef = useRef(false);
  const prevPanelAnchorRef = useRef<Anchor | null>(null);

  useLayoutEffect(() => {
    anchorVisibleRef.current = anchor !== null;
  }, [anchor]);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current !== null) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const clearFadeOutTimer = useCallback(() => {
    if (fadeOutTimerRef.current !== null) {
      clearTimeout(fadeOutTimerRef.current);
      fadeOutTimerRef.current = null;
    }
  }, []);

  /** Selection-driven `anchor` → panel mount + opacity (fade in / fade out). */
  useEffect(() => {
    if (anchor) {
      const interruptedFadeOut = fadeOutTimerRef.current !== null;
      clearFadeOutTimer();
      const prev = prevPanelAnchorRef.current;
      const needsEnterAnimation = prev === null || interruptedFadeOut;
      prevPanelAnchorRef.current = anchor;
      setPanelAnchor(anchor);
      if (needsEnterAnimation) {
        setMenuOpacityOn(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setMenuOpacityOn(true));
        });
      }
    } else {
      prevPanelAnchorRef.current = null;
      setMenuOpacityOn(false);
      clearFadeOutTimer();
      fadeOutTimerRef.current = window.setTimeout(() => {
        fadeOutTimerRef.current = null;
        setPanelAnchor(null);
      }, MENU_FADE_OUT_MS);
    }
  }, [anchor, clearFadeOutTimer]);

  const anchorFromCurrentSelection = useCallback((): Anchor | null => {
    const ed = editor;
    if (!ed || !isEditable || !ed.isEditable || !ed.isFocused) return null;
    if (!isTextFormattingSelection(ed)) return null;
    const rect = getEditorSelectionViewportRect(ed);
    if (!rect || rect.width === 0) return null;
    return {
      selectionRight: rect.right,
      selectionBottom: rect.bottom,
      selectionTop: rect.top,
    };
  }, [editor, isEditable]);

  /** Recompute menu anchor from the live selection (menu already visible); hides if selection is gone. */
  const refreshAnchorPosition = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (pointerSelectingRef.current) return;
      const next = anchorFromCurrentSelection();
      setAnchor(next);
    });
  }, [anchorFromCurrentSelection]);

  const scheduleRevealFromStableSelection = useCallback(() => {
    clearRevealTimer();
    const ed = editor;
    if (!ed || !isEditable || !ed.isEditable) {
      setAnchor(null);
      return;
    }
    if (!ed.isFocused) {
      setAnchor(null);
      return;
    }
    if (pointerSelectingRef.current) {
      setAnchor(null);
      return;
    }
    if (!isTextFormattingSelection(ed)) {
      setAnchor(null);
      return;
    }

    if (anchorVisibleRef.current) {
      refreshAnchorPosition();
      return;
    }

    const { from, to } = ed.state.selection;
    revealTimerRef.current = window.setTimeout(() => {
      revealTimerRef.current = null;
      const e2 = editor;
      if (!e2 || !isEditable || !e2.isEditable || !e2.isFocused) {
        setAnchor(null);
        return;
      }
      if (pointerSelectingRef.current) return;
      if (!isTextFormattingSelection(e2)) {
        setAnchor(null);
        return;
      }
      const s = e2.state.selection;
      if (s.from !== from || s.to !== to) return;
      const rect = getEditorSelectionViewportRect(e2);
      if (!rect || rect.width === 0) {
        setAnchor(null);
        return;
      }
      setAnchor({
        selectionRight: rect.right,
        selectionBottom: rect.bottom,
        selectionTop: rect.top,
      });
    }, STABLE_SELECTION_MS);
  }, [editor, isEditable, clearRevealTimer, refreshAnchorPosition]);

  useEffect(() => {
    return () => {
      clearRevealTimer();
      clearFadeOutTimer();
    };
  }, [clearRevealTimer, clearFadeOutTimer]);

  useEffect(() => {
    const ed = editor;
    if (!ed) return;
    const onSelectionUpdate = () => {
      setTick((t) => t + 1);
      scheduleRevealFromStableSelection();
    };
    const onTransaction = () => {
      setTick((t) => t + 1);
      if (anchorVisibleRef.current) {
        refreshAnchorPosition();
      }
    };
    ed.on("selectionUpdate", onSelectionUpdate);
    ed.on("transaction", onTransaction);
    const onBlur = () => {
      pointerSelectingRef.current = false;
      clearRevealTimer();
      setAnchor(null);
    };
    ed.on("blur", onBlur);
    return () => {
      ed.off("selectionUpdate", onSelectionUpdate);
      ed.off("transaction", onTransaction);
      ed.off("blur", onBlur);
    };
  }, [editor, scheduleRevealFromStableSelection, refreshAnchorPosition, clearRevealTimer]);

  /** Pointer on editor: treat as active selection gesture — hide menu and pause reveal until pointerup. */
  useEffect(() => {
    const ed = editor;
    if (!ed) return;
    const dom = ed.view.dom as HTMLElement;
    const onPointerDown = () => {
      pointerSelectingRef.current = true;
      clearRevealTimer();
      setAnchor(null);
    };
    const onPointerUp = () => {
      pointerSelectingRef.current = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scheduleRevealFromStableSelection();
        });
      });
    };
    dom.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerUp, true);
    };
  }, [editor, clearRevealTimer, scheduleRevealFromStableSelection]);

  useEffect(() => {
    const ed = editor;
    if (!ed) return;
    const dom = ed.view.dom as HTMLElement;
    const scrollers = [window, ...getScrollableAncestors(dom)];
    const onScroll = () => {
      if (anchorVisibleRef.current) refreshAnchorPosition();
    };
    const onResize = () => {
      if (anchorVisibleRef.current) refreshAnchorPosition();
    };
    for (const s of scrollers) {
      s.addEventListener("scroll", onScroll, { passive: true } as AddEventListenerOptions);
    }
    window.addEventListener("resize", onResize);
    return () => {
      for (const s of scrollers) {
        s.removeEventListener("scroll", onScroll);
      }
      window.removeEventListener("resize", onResize);
    };
  }, [editor, refreshAnchorPosition]);

  useLayoutEffect(() => {
    if (!panelAnchor || !menuRef.current) return;
    const menu = menuRef.current;
    const pad = 8;
    const verticalGap = 8;
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;

    let top = panelAnchor.selectionBottom + verticalGap;
    if (top + mh > window.innerHeight - pad) {
      top = panelAnchor.selectionTop - verticalGap - mh;
    }
    top = Math.min(Math.max(top, pad), window.innerHeight - mh - pad);

    // Prefer: toolbar left edge at selection’s right edge + gap (viewport coords from coordsAtPos).
    // If that would clip past the window, fall back to prior behavior (toolbar right edge at selection right).
    let left = panelAnchor.selectionRight + TOOLBAR_SELECTION_H_GAP;
    if (left + mw > window.innerWidth - pad) {
      left = panelAnchor.selectionRight - mw;
    }
    left = Math.min(Math.max(left, pad), window.innerWidth - mw - pad);

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }, [panelAnchor, tick, linkOpen, linkUrl, commentNote]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (linkOpen) {
        e.preventDefault();
        clearRevealTimer();
        setLinkOpen(false);
        return;
      }
      if (!panelAnchor) return;
      const ed = editor;
      if (ed?.isFocused && !ed.state.selection.empty) {
        e.preventDefault();
        const pos = ed.state.selection.anchor;
        ed.chain().focus().setTextSelection(pos).run();
      }
      clearRevealTimer();
      setAnchor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor, panelAnchor, linkOpen, editor, clearRevealTimer]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (menuRef.current?.contains(t)) return;
      const ed = editor;
      if (ed?.view.dom.contains(t)) return;
      clearRevealTimer();
      setLinkOpen(false);
      setAnchor(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [editor, clearRevealTimer]);

  const run = (cmd: EditorCommand) => {
    if (!editor) return;
    if (cmd === "link") {
      const prev = editor.getAttributes("link").href as string | undefined;
      setLinkUrl(prev ?? "https://");
      setLinkOpen(true);
      refreshAnchorPosition();
      return;
    }
    if (cmd === "comment") {
      setCommentNote(true);
      window.setTimeout(() => setCommentNote(false), 2200);
      refreshAnchorPosition();
      return;
    }
    onApplyFormat(cmd);
    refreshAnchorPosition();
  };

  const applyLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) onApplyFormat("link", { linkHref: null });
    else onApplyFormat("link", { linkHref: trimmed });
    setLinkOpen(false);
    refreshAnchorPosition();
  };

  const removeLink = () => {
    onApplyFormat("link", { linkHref: null });
    setLinkOpen(false);
    refreshAnchorPosition();
  };

  const act = (active: boolean) => (active ? BTN_ACTIVE : "");

  if (!panelAnchor) return null;

  const opacityTransitionClass = menuOpacityOn
    ? `pointer-events-auto opacity-100 transition-opacity ease-out [transition-duration:${MENU_FADE_IN_MS}ms]`
    : `pointer-events-none opacity-0 transition-opacity ease-in [transition-duration:${MENU_FADE_OUT_MS}ms]`;

  const row = (children: ReactNode) => (
    <div className="flex items-center justify-center gap-0">{children}</div>
  );

  const ed = editor;

  const node = (
    <div
      ref={menuRef}
      data-floating-text-menu
      className={`fixed z-[60] w-fit max-w-[calc(100vw-1rem)] rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1a1a1a] px-2 py-2.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.55),0_2px_8px_rgba(0,0,0,0.4)] [backdrop-filter:none] will-change-[opacity] ${opacityTransitionClass}`}
      style={{ left: 0, top: 0 }}
      role="toolbar"
      aria-label="Text formatting"
      onMouseDown={(e) => e.preventDefault()}
    >
      {commentNote ? (
        <p className="mb-2 max-w-[14rem] px-0.5 text-center text-[11px] leading-snug text-[rgba(234,234,234,0.72)]">
          Comments are not available yet — this space is reserved for a future flow.
        </p>
      ) : null}
      {row(
        <>
          <button
            type="button"
            className={`${BTN} ${act(!!ed?.isActive("bold"))}`}
            aria-label="Bold"
            aria-pressed={ed?.isActive("bold") ?? false}
            onClick={() => run("bold")}
          >
            <Bold size={13} strokeWidth={1.6} aria-hidden />
          </button>
          <button
            type="button"
            className={`${BTN} ${act(!!ed?.isActive("italic"))}`}
            aria-label="Italic"
            aria-pressed={ed?.isActive("italic") ?? false}
            onClick={() => run("italic")}
          >
            <Italic size={13} strokeWidth={1.6} aria-hidden />
          </button>
          <button
            type="button"
            className={`${BTN} ${act(!!ed?.isActive("underline"))}`}
            aria-label="Underline"
            aria-pressed={ed?.isActive("underline") ?? false}
            onClick={() => run("underline")}
          >
            <Underline size={13} strokeWidth={1.6} aria-hidden />
          </button>
          <button
            type="button"
            className={`${BTN} ${act(!!ed?.isActive("link"))}`}
            aria-label="Link"
            aria-pressed={ed?.isActive("link") ?? false}
            onClick={() => run("link")}
          >
            <Link2 size={13} strokeWidth={1.6} aria-hidden />
          </button>
          <button type="button" className={BTN} aria-label="Comment" onClick={() => run("comment")}>
            <MessageSquare size={13} strokeWidth={1.6} aria-hidden />
          </button>
        </>,
      )}
      {linkOpen ? (
        <div
          className="mt-2 flex min-w-[220px] max-w-[min(100vw-2rem,18rem)] flex-col gap-1.5 border-t border-[rgba(255,255,255,0.1)] pt-2"
          onMouseDown={(e) => e.preventDefault()}
        >
          <label className="sr-only" htmlFor="harvy-floating-link-url">
            Link URL
          </label>
          <input
            id="harvy-floating-link-url"
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onMouseDown={(e) => e.preventDefault()}
            className="w-full rounded border border-[rgba(255,255,255,0.14)] bg-[#222222] px-2 py-1 text-[12px] text-[#eaeaea] outline-none placeholder:text-[rgba(234,234,234,0.45)] focus:border-[rgba(255,255,255,0.28)]"
            placeholder="https://"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded px-2 py-1 text-[11px] text-[rgba(234,234,234,0.75)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[#eaeaea]"
              onClick={removeLink}
            >
              Remove
            </button>
            <button
              type="button"
              className="rounded bg-[rgba(255,255,255,0.12)] px-2.5 py-1 text-[11px] font-medium text-[#eaeaea] hover:bg-[rgba(255,255,255,0.18)]"
              onClick={applyLink}
            >
              Apply
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mx-2 my-1 h-px shrink-0 bg-[rgba(255,255,255,0.1)]" aria-hidden />
          {row(
            <>
              <button
                type="button"
                className={`${BTN} ${act(!!ed?.isActive("heading", { level: 1 }))}`}
                aria-label="Heading 1"
                aria-pressed={ed?.isActive("heading", { level: 1 }) ?? false}
                onClick={() => run("h1")}
              >
                <Heading1 size={13} strokeWidth={1.6} aria-hidden />
              </button>
              <button
                type="button"
                className={`${BTN} ${act(!!ed?.isActive("heading", { level: 2 }))}`}
                aria-label="Heading 2"
                aria-pressed={ed?.isActive("heading", { level: 2 }) ?? false}
                onClick={() => run("h2")}
              >
                <Heading2 size={13} strokeWidth={1.6} aria-hidden />
              </button>
              <button
                type="button"
                className={`${BTN} ${act(!!ed?.isActive("heading", { level: 3 }))}`}
                aria-label="Heading 3"
                aria-pressed={ed?.isActive("heading", { level: 3 }) ?? false}
                onClick={() => run("h3")}
              >
                <Heading3 size={13} strokeWidth={1.6} aria-hidden />
              </button>
              <button
                type="button"
                className={`${BTN} ${act(!!ed?.isActive("bulletList"))}`}
                aria-label="Bulleted list"
                aria-pressed={ed?.isActive("bulletList") ?? false}
                onClick={() => run("bullets")}
              >
                <List size={13} strokeWidth={1.6} aria-hidden />
              </button>
              <button
                type="button"
                className={`${BTN} ${act(!!ed?.isActive("orderedList"))}`}
                aria-label="Numbered list"
                aria-pressed={ed?.isActive("orderedList") ?? false}
                onClick={() => run("numbers")}
              >
                <ListOrdered size={13} strokeWidth={1.6} aria-hidden />
              </button>
            </>,
          )}
        </>
      )}
    </div>
  );

  return createPortal(node, document.body);
}
