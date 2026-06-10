import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { handleBackspaceOnEmptyTextBlockKeyDown } from "../features/editor/emptyTextBlockDeletion";
import { EmptyTextBlockBackspace } from "../features/editor/emptyTextBlockBackspace";
import { HarvyParagraph } from "../features/editor/harvyParagraph";
import { HarvyPlaceholder } from "../features/editor/harvyPlaceholder";
import { editorHtmlToMarkdown, toEditorHtml } from "../features/editor/documentMarkdown";
import {
  grammarDecorationsKey,
  WritingAssistance,
  writingAssistanceViewRef,
} from "../features/writing-assistance/writingAssistanceExtension";
import {
  MechanicsUnderlineLayer,
  setMechanicsUnderlinesVisible,
} from "../features/proofread/mechanicsUnderlineLayer";
import { handleEditorContextMenuEvent } from "../features/editor/editorContextMenu";
import {
  attachEditorLinkModifierCursor,
  handleEditorLinkPointerDown,
} from "../features/editor/editorLinkClick";
import { handleImageCaptionLinkPointerDown } from "../features/editor/editorImageCaptionLinks";
import { HarvyImage } from "../features/editor/harvyImage";
import type { HarvyImageLoadAttrs } from "../features/editor/harvyImageAttribution";
import { resolveWorkspaceImageSrc } from "../features/editor/imageAssets";
import { HarvyListItem } from "../features/editor/harvyListItem";
import { HarvyOrderedList } from "../features/editor/harvyOrderedList";
import { HarvyListKeyboard } from "../features/editor/harvyListKeyboard";
import { LinkEditorSelectionHighlight } from "../features/editor/linkEditorSelectionHighlight";
import { HarvyMarkdownShortcuts } from "../features/editor/harvyMarkdownShortcuts";
import { HarvyOutlineParagraph } from "../features/outline/harvyOutlineParagraph";
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
  /** Mechanics dotted underlines — visible only when the Edit sidebar is open. */
  showMechanicsUnderlines: boolean;
  onChangeText: (value: string) => void;
  /** Fires when the TipTap instance is created or destroyed (null on unmount). */
  onEditorReady: (editor: Editor | null) => void;
  /** Called after each content-changing update (typing, paste, etc.). */
  onTypingActivity?: () => void;
  /** Workspace root for resolving `.harvy/assets/...` image paths in the Tauri app. */
  workspaceRootPath?: string | null;
  /** Local file picker → workspace-relative `src`. */
  pickLocalImage?: () => Promise<string | null>;
  /** Load image `src` onto the block at `pos`. */
  loadImageAt?: (pos: number, attrs: HarvyImageLoadAttrs) => void;
  /** Insert image block at cursor (same flow as context menu action). */
  onInsertImage?: () => void | Promise<void>;
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
  showMechanicsUnderlines,
  onChangeText,
  onEditorReady,
  onTypingActivity,
  workspaceRootPath = null,
  pickLocalImage,
  loadImageAt,
  onInsertImage,
}: EditorCanvasProps) {
  const pickLocalImageRef = useRef(pickLocalImage);
  pickLocalImageRef.current = pickLocalImage;
  const loadImageAtRef = useRef(loadImageAt);
  loadImageAtRef.current = loadImageAt;
  const onInsertImageRef = useRef(onInsertImage);
  onInsertImageRef.current = onInsertImage;
  const isEditableRef = useRef(isEditable);
  isEditableRef.current = isEditable;
  const workspaceRootPathRef = useRef(workspaceRootPath);
  workspaceRootPathRef.current = workspaceRootPath;
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
          listItem: false,
          orderedList: false,
          gapcursor: false,
        }),
        EmptyTextBlockBackspace,
        HarvyParagraph,
        HarvyListItem,
        HarvyOrderedList,
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: false,
          HTMLAttributes: {
            class: "harvy-editor-link underline decoration-from-font underline-offset-[0.12em]",
          },
        }),
        HarvyOutlineParagraph,
        HarvyImage,
        HarvyPlaceholder.configure({
          placeholder: placeholder ?? "",
        }),
        WritingAssistance,
        MechanicsUnderlineLayer,
        LinkEditorSelectionHighlight,
        HarvyMarkdownShortcuts,
        HarvyListKeyboard,
      ],
      content: toEditorHtml(text, { sourcePath: contentSourcePath }),
      editable: isEditable,
      enableInputRules: ["harvyMarkdownShortcuts"],
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
        handleKeyDown: (view, event) => handleBackspaceOnEmptyTextBlockKeyDown(view, event),
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
    setMechanicsUnderlinesVisible(editor.view, showMechanicsUnderlines);
  }, [editor, showMechanicsUnderlines]);

  useEffect(() => {
    if (!editor) return;
    const storage = editor.storage.harvyImage;
    if (storage) {
      storage.resolveSrc = (storedSrc: string) =>
        resolveWorkspaceImageSrc(workspaceRootPathRef.current, storedSrc);
      storage.pickLocalImage = () => pickLocalImageRef.current?.() ?? Promise.resolve(null);
      storage.loadImageAt = (pos: number, attrs: HarvyImageLoadAttrs) =>
        loadImageAtRef.current?.(pos, attrs);
    }
  }, [editor, workspaceRootPath, pickLocalImage, loadImageAt]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const detachModifierCursor = attachEditorLinkModifierCursor(dom);
    return detachModifierCursor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const prior = editor.options.editorProps?.handleDOMEvents ?? {};
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        handleDOMEvents: {
          ...prior,
          mousedown: (view, event) => {
            if (handleEditorLinkPointerDown(event as MouseEvent)) return true;
            if (handleImageCaptionLinkPointerDown(event as MouseEvent)) return true;
            return prior.mousedown?.(view, event) ?? false;
          },
          contextmenu: (view, event) => {
            if (!isEditableRef.current) return false;
            return handleEditorContextMenuEvent(view, event as MouseEvent, {
              canInsertImage: Boolean(onInsertImageRef.current),
              onInsertImage: () => onInsertImageRef.current?.(),
              placeCaret: true,
            });
          },
          dblclick: (view, event) => {
            if (!isEditableRef.current) return false;
            return handleEditorContextMenuEvent(view, event as MouseEvent, {
              canInsertImage: Boolean(onInsertImageRef.current),
              onInsertImage: () => onInsertImageRef.current?.(),
              placeCaret: false,
            });
          },
        },
      },
    });
  }, [editor, onInsertImage, isEditable]);

  return (
    <div className="box-border flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent border border-solid border-transparent">
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
