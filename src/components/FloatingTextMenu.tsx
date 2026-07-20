import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import type { Editor } from "@tiptap/core";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  MessageSquareQuote,
  Underline,
} from "lucide-react";
import type { EditorCommand } from "../features/editor/commands";
import type { LinkFormatOptions } from "../features/editor/editorFormatActions";
import { isTextFormattingSelection } from "../features/editor/floatingTextMenuSelection";
import {
  clearLinkEditorSelectionHighlight,
  setLinkEditorSelectionHighlight,
} from "../features/editor/linkEditorSelectionHighlight";
import { parseLinkUrl } from "../features/editor/linkUrlValidation";
import {
  HARVY_CONTEXT_MENU_TOOLBAR_BTN_ACTIVE_CLASS,
  HARVY_CONTEXT_MENU_TOOLBAR_BTN_CLASS,
  HARVY_CONTEXT_MENU_TOOLBAR_CLASS,
  type HarvyContextMenuAnchorRange,
} from "../features/editor/harvyContextMenu";
import {
  HarvyContextMenuPortal,
  HarvyContextMenuShell,
  useHarvyContextMenuPortal,
} from "./HarvyContextMenu";

/** Wait this long after the last selection change (and after pointer release) before showing the menu. */
const STABLE_SELECTION_MS = 100;

const MENU_FADE_IN_MS = 500;
const MENU_FADE_OUT_MS = 250;

type FloatingTextMenuProps = {
  editor: Editor | null;
  isEditable: boolean;
  onApplyFormat: (command: EditorCommand, opts?: LinkFormatOptions) => void;
};

export function FloatingTextMenu({ editor, isEditable, onApplyFormat }: FloatingTextMenuProps) {
  const [anchor, setAnchor] = useState<HarvyContextMenuAnchorRange | null>(null);
  const [panelAnchor, setPanelAnchor] = useState<HarvyContextMenuAnchorRange | null>(null);
  const [menuOpacityOn, setMenuOpacityOn] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkUrlError, setLinkUrlError] = useState("");
  const revealTimerRef = useRef<number | null>(null);
  const fadeOutTimerRef = useRef<number | null>(null);
  const pointerSelectingRef = useRef(false);
  const anchorVisibleRef = useRef(false);
  const linkOpenRef = useRef(false);
  const linkSelectionRef = useRef<HarvyContextMenuAnchorRange | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    linkOpenRef.current = linkOpen;
    if (!linkOpen) setLinkUrlError("");
  }, [linkOpen]);

  useEffect(() => {
    if (!linkOpen) return;
    const input = linkInputRef.current;
    if (!input) return;
    requestAnimationFrame(() => {
      input.focus();
      if (input.value) input.select();
    });
  }, [linkOpen]);

  useEffect(() => {
    const view = editor?.view;
    if (!view) return;
    if (linkOpen && linkSelectionRef.current) {
      const { from, to } = linkSelectionRef.current;
      setLinkEditorSelectionHighlight(view, from, to);
    } else {
      clearLinkEditorSelectionHighlight(view);
    }
    return () => clearLinkEditorSelectionHighlight(view);
  }, [linkOpen, editor]);

  const closeMenu = useCallback(() => {
    if (linkOpenRef.current) {
      setLinkOpen(false);
      return;
    }
    linkSelectionRef.current = null;
    setLinkOpen(false);
    setAnchor(null);
  }, []);

  const { menuRef, mountEl, reposition } = useHarvyContextMenuPortal({
    editor,
    anchor: panelAnchor,
    placement: "beside-below-end",
    visible: panelAnchor !== null,
    onClose: closeMenu,
    repositionDeps: [linkOpen, linkUrl, linkUrlError, menuOpacityOn],
  });

  useEffect(() => {
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

  useEffect(() => {
    if (anchor) {
      const interruptedFadeOut = fadeOutTimerRef.current !== null;
      clearFadeOutTimer();
      setPanelAnchor(anchor);
      if (interruptedFadeOut || panelAnchor === null) {
        setMenuOpacityOn(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setMenuOpacityOn(true));
        });
      }
    } else {
      setMenuOpacityOn(false);
      clearFadeOutTimer();
      fadeOutTimerRef.current = window.setTimeout(() => {
        fadeOutTimerRef.current = null;
        setPanelAnchor(null);
      }, MENU_FADE_OUT_MS);
    }
  }, [anchor, clearFadeOutTimer, panelAnchor]);

  const anchorFromCurrentSelection = useCallback((): HarvyContextMenuAnchorRange | null => {
    if (linkOpenRef.current && linkSelectionRef.current) {
      return linkSelectionRef.current;
    }
    const ed = editor;
    if (!ed || !isEditable || !ed.isEditable || !ed.isFocused) return null;
    if (!isTextFormattingSelection(ed)) return null;
    const { from, to, empty } = ed.state.selection;
    if (empty || from >= to) return null;
    return { from, to };
  }, [editor, isEditable]);

  const refreshAnchorPosition = useCallback(() => {
    if (pointerSelectingRef.current) return;
    if (linkOpenRef.current && linkSelectionRef.current) {
      setAnchor(linkSelectionRef.current);
      reposition();
      return;
    }
    const next = anchorFromCurrentSelection();
    setAnchor(next);
    if (next) reposition();
  }, [anchorFromCurrentSelection, reposition]);

  const scheduleRevealFromStableSelection = useCallback(() => {
    if (linkOpenRef.current) {
      if (linkSelectionRef.current) {
        setAnchor(linkSelectionRef.current);
        reposition();
      }
      return;
    }
    clearRevealTimer();
    const ed = editor;
    if (!ed || !isEditable || !ed.isEditable || !ed.isFocused || pointerSelectingRef.current) {
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
      if (!e2 || !isEditable || !e2.isEditable || !e2.isFocused || pointerSelectingRef.current) {
        setAnchor(null);
        return;
      }
      if (!isTextFormattingSelection(e2)) {
        setAnchor(null);
        return;
      }
      const s = e2.state.selection;
      if (s.from !== from || s.to !== to) return;
      if (s.empty || s.from >= s.to) {
        setAnchor(null);
        return;
      }
      setAnchor({ from: s.from, to: s.to });
    }, STABLE_SELECTION_MS);
  }, [editor, isEditable, clearRevealTimer, refreshAnchorPosition, reposition]);

  useEffect(() => {
    return () => {
      clearRevealTimer();
      clearFadeOutTimer();
    };
  }, [clearRevealTimer, clearFadeOutTimer]);

  useEffect(() => {
    const ed = editor;
    if (!ed) return;
    const onSelectionUpdate = () => scheduleRevealFromStableSelection();
    const onTransaction = () => {
      if (anchorVisibleRef.current) refreshAnchorPosition();
    };
    ed.on("selectionUpdate", onSelectionUpdate);
    ed.on("transaction", onTransaction);
    const onBlur = () => {
      pointerSelectingRef.current = false;
      clearRevealTimer();
      if (linkOpenRef.current) return;
      setAnchor(null);
    };
    ed.on("blur", onBlur);
    return () => {
      ed.off("selectionUpdate", onSelectionUpdate);
      ed.off("transaction", onTransaction);
      ed.off("blur", onBlur);
    };
  }, [editor, scheduleRevealFromStableSelection, refreshAnchorPosition, clearRevealTimer]);

  useEffect(() => {
    const ed = editor;
    if (!ed) return;
    const dom = ed.view.dom as HTMLElement;
    const onPointerDown = () => {
      pointerSelectingRef.current = true;
      clearRevealTimer();
      if (linkOpenRef.current) {
        setLinkOpen(false);
        return;
      }
      setAnchor(null);
    };
    const onPointerUp = () => {
      pointerSelectingRef.current = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scheduleRevealFromStableSelection());
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
    if (!panelAnchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (linkOpen) {
        e.preventDefault();
        clearRevealTimer();
        setLinkOpen(false);
        return;
      }
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
  }, [panelAnchor, linkOpen, editor, clearRevealTimer]);

  const openLinkPopover = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty || from >= to) return;
    linkSelectionRef.current = { from, to };
    setAnchor({ from, to });
    const prev = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(prev ?? "");
    setLinkUrlError("");
    setLinkOpen(true);
    reposition();
  };

  const restoreLinkSelection = useCallback(() => {
    if (!editor || !linkSelectionRef.current) return false;
    const { from, to } = linkSelectionRef.current;
    return editor.chain().focus().setTextSelection({ from, to }).run();
  }, [editor]);

  const run = (cmd: EditorCommand) => {
    if (!editor) return;
    onApplyFormat(cmd);
    refreshAnchorPosition();
  };

  const applyLink = () => {
    if (!editor || !linkSelectionRef.current) return;

    const parsed = parseLinkUrl(linkUrl);
    if (parsed.ok === false) {
      if (parsed.reason === "invalid") {
        setLinkUrlError("Please enter a valid URL");
      }
      return;
    }

    const { from, to } = linkSelectionRef.current;
    restoreLinkSelection();
    onApplyFormat("link", { linkHref: parsed.href });
    setLinkUrlError("");
    setLinkOpen(false);
    requestAnimationFrame(() => {
      if (!editor) return;
      editor.chain().focus().setTextSelection({ from, to }).run();
      setAnchor({ from, to });
      reposition();
    });
  };

  const removeLink = () => {
    if (!editor || !linkSelectionRef.current) return;
    const { from, to } = linkSelectionRef.current;
    restoreLinkSelection();
    onApplyFormat("link", { linkHref: null });
    setLinkOpen(false);
    requestAnimationFrame(() => {
      if (!editor) return;
      editor.chain().focus().setTextSelection({ from, to }).run();
      setAnchor({ from, to });
      reposition();
    });
  };

  const act = (active: boolean) => (active ? HARVY_CONTEXT_MENU_TOOLBAR_BTN_ACTIVE_CLASS : "");

  if (!panelAnchor || !mountEl) return null;

  const opacityTransitionClass = menuOpacityOn
    ? `pointer-events-auto opacity-100 transition-opacity ease-out [transition-duration:${MENU_FADE_IN_MS}ms]`
    : `pointer-events-none opacity-0 transition-opacity ease-in [transition-duration:${MENU_FADE_OUT_MS}ms]`;

  const row = (children: ReactNode) => (
    <div className={HARVY_CONTEXT_MENU_TOOLBAR_CLASS}>{children}</div>
  );

  const ed = editor;

  return (
    <HarvyContextMenuPortal mountEl={mountEl}>
      <HarvyContextMenuShell
        menuRef={menuRef}
        role={linkOpen ? "dialog" : "toolbar"}
        ariaLabel={linkOpen ? "Edit link" : "Text formatting"}
        className={`harvy-context-menu--toolbar w-fit max-w-[calc(100vw-1rem)] will-change-[opacity] ${linkOpen ? "harvy-context-menu--link-editor" : ""} ${opacityTransitionClass}`}
      >
        {linkOpen ? (
          <div
            className="harvy-context-menu__link-panel harvy-context-menu__link-panel--solo"
            onMouseDown={(e) => e.preventDefault()}
          >
            <label className="sr-only" htmlFor="harvy-floating-link-url">
              Link URL
            </label>
            <input
              ref={linkInputRef}
              id="harvy-floating-link-url"
              type="text"
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                if (linkUrlError) setLinkUrlError("");
              }}
              onMouseDown={(e) => e.preventDefault()}
              className="harvy-context-menu__link-input"
              placeholder="Paste a link..."
              aria-invalid={linkUrlError ? true : undefined}
              aria-describedby={linkUrlError ? "harvy-floating-link-url-error" : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                }
              }}
            />
            {linkUrlError ? (
              <p id="harvy-floating-link-url-error" className="harvy-context-menu__link-error" role="alert">
                {linkUrlError}
              </p>
            ) : null}
            <div className="harvy-context-menu__link-actions">
              <button type="button" className="harvy-context-menu__link-btn" onClick={removeLink}>
                Remove
              </button>
              <button
                type="button"
                className="harvy-context-menu__link-btn harvy-context-menu__link-btn--primary"
                onClick={applyLink}
              >
                Apply
              </button>
            </div>
          </div>
        ) : (
          <>
            {row(
              <>
                <button
                  type="button"
                  className={`${HARVY_CONTEXT_MENU_TOOLBAR_BTN_CLASS} ${act(!!ed?.isActive("bold"))}`}
                  aria-label="Bold"
                  aria-pressed={ed?.isActive("bold") ?? false}
                  onClick={() => run("bold")}
                >
                  <Bold size={13} strokeWidth={1.6} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${HARVY_CONTEXT_MENU_TOOLBAR_BTN_CLASS} ${act(!!ed?.isActive("italic"))}`}
                  aria-label="Italic"
                  aria-pressed={ed?.isActive("italic") ?? false}
                  onClick={() => run("italic")}
                >
                  <Italic size={13} strokeWidth={1.6} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${HARVY_CONTEXT_MENU_TOOLBAR_BTN_CLASS} ${act(!!ed?.isActive("underline"))}`}
                  aria-label="Underline"
                  aria-pressed={ed?.isActive("underline") ?? false}
                  onClick={() => run("underline")}
                >
                  <Underline size={13} strokeWidth={1.6} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${HARVY_CONTEXT_MENU_TOOLBAR_BTN_CLASS} ${act(!!ed?.isActive("link"))}`}
                  aria-label="Link"
                  aria-pressed={ed?.isActive("link") ?? false}
                  onMouseDown={openLinkPopover}
                >
                  <Link2 size={13} strokeWidth={1.6} aria-hidden />
                </button>
              </>,
            )}
            {row(
              <>
                <button
                  type="button"
                  className={`${HARVY_CONTEXT_MENU_TOOLBAR_BTN_CLASS} ${act(!!ed?.isActive("blockquote"))}`}
                  aria-label="Quote"
                  aria-pressed={ed?.isActive("blockquote") ?? false}
                  onClick={() => run("quote")}
                >
                  <MessageSquareQuote size={13} strokeWidth={1.6} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${HARVY_CONTEXT_MENU_TOOLBAR_BTN_CLASS} ${act(!!ed?.isActive("heading", { level: 1 }))}`}
                  aria-label="Heading 1"
                  aria-pressed={ed?.isActive("heading", { level: 1 }) ?? false}
                  onClick={() => run("h1")}
                >
                  <Heading1 size={13} strokeWidth={1.6} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${HARVY_CONTEXT_MENU_TOOLBAR_BTN_CLASS} ${act(!!ed?.isActive("heading", { level: 2 }))}`}
                  aria-label="Heading 2"
                  aria-pressed={ed?.isActive("heading", { level: 2 }) ?? false}
                  onClick={() => run("h2")}
                >
                  <Heading2 size={13} strokeWidth={1.6} aria-hidden />
                </button>
                <button
                  type="button"
                  className={`${HARVY_CONTEXT_MENU_TOOLBAR_BTN_CLASS} ${act(!!ed?.isActive("heading", { level: 3 }))}`}
                  aria-label="Heading 3"
                  aria-pressed={ed?.isActive("heading", { level: 3 }) ?? false}
                  onClick={() => run("h3")}
                >
                  <Heading3 size={13} strokeWidth={1.6} aria-hidden />
                </button>
              </>,
            )}
          </>
        )}
      </HarvyContextMenuShell>
    </HarvyContextMenuPortal>
  );
}
