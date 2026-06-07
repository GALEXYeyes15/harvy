import type { Editor } from "@tiptap/core";
import { Check, Copy, Eye, EyeOff, ListTree, PenLine, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  convertBlockToHeading,
  convertBlockToInstruction,
  convertBlockToPlaceholder,
} from "../features/outline/outlineBlockConversion";
import { documentToOutlinePlainText } from "../features/outline/outlineDocumentPlainText";

const COPY_OK_MS = 1200;

const BTN_BASE =
  "flex w-full items-center justify-center gap-2 rounded-md border border-line/40 bg-stage px-3 py-2 text-[13px] font-medium text-ink/90 transition-colors hover:bg-mist/80 dark:border-white/[0.1] dark:hover:bg-white/[0.04]";

const BTN_SECONDARY =
  "flex w-full items-center justify-center gap-2 rounded-md border border-line/25 bg-transparent px-3 py-2 text-[13px] font-medium text-muted/90 transition-colors hover:bg-ink/[0.04] dark:border-white/[0.08] dark:hover:bg-white/[0.04]";

type WriteOutlineToolsProps = {
  editor: Editor | null;
  createOutlineMode: boolean;
  onCreateOutlineModeChange?: (on: boolean) => void;
  outlineInstructionsVisible?: boolean;
  onOutlineInstructionsVisibleChange?: (visible: boolean) => void;
};

export function WriteOutlineTools({
  editor,
  createOutlineMode,
  onCreateOutlineModeChange = () => {},
  outlineInstructionsVisible = true,
  onOutlineInstructionsVisibleChange,
}: WriteOutlineToolsProps) {
  const [copyOk, setCopyOk] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const onCopyOutline = useCallback(async () => {
    if (!editor) return;
    const text = documentToOutlinePlainText(editor.state.doc);
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
      await navigator.clipboard.writeText(text);
      setCopyOk(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        copyTimerRef.current = null;
        setCopyOk(false);
      }, COPY_OK_MS);
    } catch {
      setCopyOk(false);
    }
  }, [editor]);

  const exitMode = useCallback(() => {
    onCreateOutlineModeChange(false);
    onOutlineInstructionsVisibleChange?.(true);
  }, [onCreateOutlineModeChange, onOutlineInstructionsVisibleChange]);

  const authoringDisabled = !editor || !editor.isEditable;
  const canToggleInstructions =
    createOutlineMode && typeof onOutlineInstructionsVisibleChange === "function";

  return (
    <div className="space-y-3">
      {!createOutlineMode ? (
        <>
          <button
            type="button"
            className={BTN_BASE}
            disabled={authoringDisabled}
            onClick={() => onCreateOutlineModeChange(true)}
          >
            <ListTree size={16} strokeWidth={1.75} className="shrink-0 text-muted/70" aria-hidden />
            <span className="flex-1 text-center">Create Outline Mode</span>
          </button>
          <p className="text-[12px] leading-snug text-muted/65">
            Turn on to tag blocks as headings, placeholders, or instructions and copy an outline-friendly text
            snapshot of your document.
          </p>
        </>
      ) : (
        <>
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted/70">Outline authoring</p>
          <p className="text-[12px] leading-snug text-muted/65">
            Converts the block containing the cursor or selection (not a partial inline range). Normal paragraphs
            elsewhere stay draft text and are omitted from Copy Outline.
          </p>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              className={BTN_BASE}
              disabled={authoringDisabled}
              onClick={() => convertBlockToHeading(editor!)}
            >
              <PenLine size={16} strokeWidth={1.75} className="shrink-0 text-muted/70" aria-hidden />
              <span className="flex-1 text-center">Turn into Heading</span>
            </button>
            <button
              type="button"
              className={BTN_BASE}
              disabled={authoringDisabled}
              onClick={() => convertBlockToPlaceholder(editor!)}
            >
              <span className="flex-1 text-center">Turn into Placeholder</span>
            </button>
            <button
              type="button"
              className={BTN_BASE}
              disabled={authoringDisabled}
              onClick={() => convertBlockToInstruction(editor!)}
            >
              <span className="flex-1 text-center">Turn into Instruction</span>
            </button>
          </div>

          {canToggleInstructions ? (
            <button
              type="button"
              className={BTN_BASE}
              aria-pressed={outlineInstructionsVisible}
              onClick={() => onOutlineInstructionsVisibleChange?.(!outlineInstructionsVisible)}
            >
              {outlineInstructionsVisible ? (
                <EyeOff size={16} strokeWidth={1.75} className="shrink-0 text-muted/70" aria-hidden />
              ) : (
                <Eye size={16} strokeWidth={1.75} className="shrink-0 text-muted/70" aria-hidden />
              )}
              <span className="flex-1 text-center">
                {outlineInstructionsVisible ? "Hide Instructions" : "Show Instructions"}
              </span>
            </button>
          ) : null}

          <button type="button" className={BTN_BASE} disabled={authoringDisabled} onClick={() => void onCopyOutline()}>
            {copyOk ? (
              <>
                <Check size={16} strokeWidth={1.75} className="text-[#4ade80]" aria-hidden />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy size={16} strokeWidth={1.75} aria-hidden />
                <span>Copy Outline</span>
              </>
            )}
          </button>

          <button type="button" className={BTN_SECONDARY} onClick={exitMode}>
            <X size={16} strokeWidth={1.75} className="shrink-0 text-muted/70" aria-hidden />
            <span className="flex-1 text-center">Exit Outline Mode</span>
          </button>
        </>
      )}
    </div>
  );
}
