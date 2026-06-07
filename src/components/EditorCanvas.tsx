import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { HarvyParagraph } from "../features/editor/harvyParagraph";
import { HarvyPlaceholder } from "../features/editor/harvyPlaceholder";
import { editorHtmlToMarkdown, toEditorHtml } from "../features/editor/documentMarkdown";
import {
  grammarDecorationsKey,
  WritingAssistance,
  writingAssistanceViewRef,
} from "../features/writing-assistance/writingAssistanceExtension";
import {
  clearProofreadDecorations,
  ProofreadDecorations,
  proofreadDecorationsKey,
  proofreadDecorationsViewRef,
} from "../features/proofread/proofreadDecorations";
import { HarvyOutlineParagraph } from "../features/outline/harvyOutlineParagraph";
import { syncOutlinePlaceholdersForAuthoringMode } from "../features/outline/syncOutlinePlaceholdersForAuthoringMode";
import type { SidebarToolsMode } from "../features/sidebar/sidebarToolsMode";

type EditorCanvasProps = {
  mode: SidebarToolsMode;
  documentTitle: string;
  /** Stored document (Markdown or legacy HTML). */
  text: string;
  /** When opening a file, used to choose Markdown vs plain vs HTML. */
  contentSourcePath?: string | null;
  placeholder?: string;
  isEditable: boolean;
  /** When true, sets `spellcheck` on the ProseMirror root (native wavy underlines). Shell should gate Edit tab + panel + user pref. */
  spellcheckEnabled: boolean;
  grammarChecksEnabled: boolean;
  showReadabilityHighlights: boolean;
  onChangeText: (value: string) => void;
  /** Fires when the TipTap instance is created or destroyed (null on unmount). */
  onEditorReady: (editor: Editor | null) => void;
  /** Called after each content-changing update (typing, paste, etc.). */
  onTypingActivity?: () => void;
  /** When false, outline instruction paragraphs are hidden in the editor (CSS only; document unchanged). */
  showOutlineInstructions?: boolean;
  /** Create Outline Mode: 1px muted frame around the editor canvas (not the toolbar). */
  createOutlineMode?: boolean;
};

export function EditorCanvas({
  mode: _mode,
  documentTitle,
  text,
  contentSourcePath = null,
  placeholder,
  isEditable,
  spellcheckEnabled,
  grammarChecksEnabled,
  showReadabilityHighlights,
  onChangeText,
  onEditorReady,
  onTypingActivity,
  showOutlineInstructions = true,
  createOutlineMode = false,
}: EditorCanvasProps) {
  const onTypingActivityRef = useRef(onTypingActivity);
  onTypingActivityRef.current = onTypingActivity;

  const editor = useEditor(
    {
      immediatelyRender: true,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          codeBlock: false,
          paragraph: false,
        }),
        HarvyParagraph,
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: false,
          HTMLAttributes: {
            class: "harvy-editor-link underline decoration-from-font underline-offset-[0.12em]",
          },
        }),
        HarvyOutlineParagraph,
        HarvyPlaceholder.configure({
          placeholder: placeholder ?? "",
        }),
        WritingAssistance,
        ProofreadDecorations,
      ],
      content: toEditorHtml(text, { sourcePath: contentSourcePath }),
      editable: isEditable,
      editorProps: {
        attributes: {
          id: "harvy-editor",
          role: "textbox",
          "aria-multiline": "true",
          spellcheck: spellcheckEnabled ? "true" : "false",
          class:
            "editor-content ProseMirror-harvy block min-h-0 w-full max-w-none resize-none bg-transparent py-10 text-[18px] font-normal text-ink caret-muted outline-none focus:outline-none placeholder:text-muted/45 sm:py-11 " +
            (isEditable ? "" : "cursor-default select-text opacity-75"),
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChangeText(editorHtmlToMarkdown(ed.getHTML()));
        onTypingActivityRef.current?.();
      },
    },
    [isEditable, placeholder],
  );

  useEffect(() => {
    onEditorReady(editor);
    return () => onEditorReady(null);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(isEditable);
  }, [editor, isEditable]);

  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom;
    root.setAttribute("spellcheck", spellcheckEnabled ? "true" : "false");
  }, [editor, spellcheckEnabled]);

  useEffect(() => {
    if (!editor) return;
    writingAssistanceViewRef.showReadabilityHighlights = showReadabilityHighlights;
    const tr = editor.state.tr.setMeta(grammarDecorationsKey, true);
    editor.view.dispatch(tr);
  }, [editor, grammarChecksEnabled, showReadabilityHighlights]);

  useEffect(() => {
    if (!editor) return;
    proofreadDecorationsViewRef.enabled = showReadabilityHighlights;
    const tr = editor.state.tr.setMeta(proofreadDecorationsKey, true);
    editor.view.dispatch(tr);
    if (!showReadabilityHighlights) {
      clearProofreadDecorations(editor.view);
    }
  }, [editor, showReadabilityHighlights]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    dom.classList.toggle("ProseMirror-harvy--hide-outline-instructions", !showOutlineInstructions);
    return () => {
      dom.classList.remove("ProseMirror-harvy--hide-outline-instructions");
    };
  }, [editor, showOutlineInstructions]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    dom.classList.toggle("ProseMirror-harvy--outline-authoring", createOutlineMode);
    return () => {
      dom.classList.remove("ProseMirror-harvy--outline-authoring");
    };
  }, [editor, createOutlineMode]);

  useEffect(() => {
    if (!editor) return;
    editor.storage.harvyOutlineParagraph.createOutlineMode = createOutlineMode;
    const tr = syncOutlinePlaceholdersForAuthoringMode(editor.state, createOutlineMode);
    if (tr) {
      editor.view.dispatch(tr);
    }
  }, [editor, createOutlineMode]);

  return (
    <div
      className={`box-border flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent border border-solid ${
        createOutlineMode ? "rounded-[30px] border-[#6f6f6f]" : "border-transparent"
      }`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
        <div className="min-h-full w-full px-10 pb-52 pt-2 sm:px-14 sm:pb-9 sm:pt-2.5">
          <label htmlFor="harvy-editor" className="sr-only">
            {documentTitle}
          </label>
          <EditorContent editor={editor} className="block w-full pb-52" />
        </div>
      </div>
    </div>
  );
}
