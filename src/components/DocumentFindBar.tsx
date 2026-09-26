import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import type { Editor } from "@tiptap/core";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { activeFindIndex, resolveDocumentFindSeed, wrapFindIndex } from "../features/editor/documentFind";
import {
  applyDocumentFind,
  clearDocumentFind,
  documentFindHighlightKey,
  scrollDocumentFindActive,
} from "../features/editor/documentFindHighlight";
import { findWorkspaceSearchPmRanges } from "../features/editor/workspaceSearchHighlight";

export type DocumentFindBarHandle = {
  focusInput: () => void;
};

type DocumentFindBarProps = {
  editor: Editor | null;
  /** When set, Find opens on this word instead of the current selection. */
  initialQuery?: string;
  onClose: () => void;
  barRef?: Ref<DocumentFindBarHandle>;
};

export function DocumentFindBar({ editor, initialQuery, onClose, barRef }: DocumentFindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // The editor column clips overflow, so the bar is fixed to its top-right and
  // pulled up a little so it sits on the tab strip.
  useLayoutEffect(() => {
    const el = rootRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const place = () => {
      const rect = parent.getBoundingClientRect();
      el.style.top = `${rect.top - 3}px`;
      el.style.right = `${Math.max(12, window.innerWidth - rect.right + 12)}px`;
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(parent);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);

  useImperativeHandle(barRef, () => ({
    focusInput() {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
  }));

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const seed = resolveDocumentFindSeed(initialQuery, editor);
    const from = editor.state.selection.from;
    const ranges = findWorkspaceSearchPmRanges(editor.state.doc, seed);
    const index = activeFindIndex(ranges, from);
    setQuery(seed);
    const next = applyDocumentFind(editor.view, seed, index);
    setMatchCount(next.ranges.length);
    setActiveIndex(next.activeIndex);
    if (next.ranges.length > 0) scrollDocumentFindActive(editor.view);
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editor, initialQuery]);

  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const current = documentFindHighlightKey.getState(editor.state);
      if (!current) return;
      setMatchCount(current.ranges.length);
      setActiveIndex(current.activeIndex);
    };
    editor.on("transaction", sync);
    return () => {
      editor.off("transaction", sync);
    };
  }, [editor]);

  useEffect(() => {
    return () => {
      if (!editor || editor.isDestroyed) return;
      clearDocumentFind(editor.view);
    };
  }, [editor]);

  function close() {
    if (editor && !editor.isDestroyed) {
      clearDocumentFind(editor.view);
      editor.commands.focus();
    }
    onClose();
  }

  function publish(nextQuery: string, index: number) {
    if (!editor || editor.isDestroyed) return;
    const next = applyDocumentFind(editor.view, nextQuery, index);
    setMatchCount(next.ranges.length);
    setActiveIndex(next.activeIndex);
    if (next.ranges.length > 0) scrollDocumentFindActive(editor.view);
  }

  function step(delta: number) {
    if (matchCount === 0) return;
    publish(query, wrapFindIndex(activeIndex, matchCount, delta));
  }

  const countLabel =
    query.trim().length === 0 ? null : matchCount === 0 ? "No results" : `${activeIndex + 1}/${matchCount}`;

  return (
    <div
      ref={rootRef}
      className="harvy-document-find pointer-events-auto fixed z-40 flex h-11 w-[min(18.5rem,calc(100%-1.5rem))] items-center rounded-lg py-1.5 pl-1.5 pr-1"
      role="search"
      data-harvy-document-find
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        aria-label="Find in document"
        placeholder="Find"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="harvy-document-find-input min-w-0 flex-1 px-2 py-1 text-[13px] text-ink outline-none placeholder:text-muted/45"
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          const from = editor && !editor.isDestroyed ? editor.state.selection.from : 0;
          const ranges = editor ? findWorkspaceSearchPmRanges(editor.state.doc, next) : [];
          publish(next, activeFindIndex(ranges, from));
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            step(event.shiftKey ? -1 : 1);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            step(1);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            step(-1);
          }
        }}
      />
      {countLabel ? (
        <span className="shrink-0 px-1.5 text-[12px] tabular-nums text-muted/60" aria-live="polite">
          {countLabel}
        </span>
      ) : null}
      <button
        type="button"
        aria-label="Previous match"
        disabled={matchCount === 0}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted/80 transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-35"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => step(-1)}
      >
        <ChevronUp size={15} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Next match"
        disabled={matchCount === 0}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted/80 transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-35"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => step(1)}
      >
        <ChevronDown size={15} strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Close find"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted/80 transition-colors hover:bg-ink/[0.06] hover:text-ink"
        onMouseDown={(event) => event.preventDefault()}
        onClick={close}
      >
        <X size={14} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
