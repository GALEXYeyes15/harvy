import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { handleBackspaceOnEmptyTextBlockKeyDown } from "../features/editor/emptyTextBlockDeletion";
import { EmptyTextBlockBackspace } from "../features/editor/emptyTextBlockBackspace";
import { FocusModeGuards, isFocusModeBlockedKey } from "../features/editor/focusModeGuards";
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
import {
  type EditorCanvasFocusControl,
  handleEditorCanvasFocusPointerDown,
  handleEditorWritingSurfacePointerDown,
  rejectEditorFocusIfSuppressed,
} from "../features/editor/editorCanvasFocus";
import {
  handleEditorContextMenuEvent,
  tryOpenMechanicsSuggestionPopover,
  tryOpenSpellingSuggestionPopover,
} from "../features/editor/editorContextMenu";
import { closeHarvyContextMenu } from "../features/editor/harvyContextMenu";
import type { HeadlinePair } from "../features/aiCheck/aiCheck";
import { HeadlineSuggestMenu } from "./HeadlineSuggestMenu";
import {
  attachEditorLinkModifierCursor,
  handleEditorLinkPointerDown,
} from "../features/editor/editorLinkClick";
import { handleImageCaptionLinkPointerDown } from "../features/editor/editorImageCaptionLinks";
import { HarvyImage } from "../features/editor/harvyImage";
import type { HarvyImageLoadAttrs } from "../features/editor/harvyImageAttribution";
import { resolveWorkspaceImageSrc } from "../features/editor/imageAssets";
import {
  HARVY_SIDEBAR_IMAGE_DROP_EVENT,
  insertImageSrcsAtClientCoords,
  resolveFilesystemImageSrc,
  resolveImageSrcsFromDataTransfer,
  resolveImageSrcsFromPaths,
  shouldHandleHtmlImageDrop,
  type SidebarImageDropDetail,
} from "../features/editor/imageDrop";
import { isTauriRuntime } from "../features/save/saveRuntime";
import { HarvyListItem } from "../features/editor/harvyListItem";
import { HarvyOrderedList } from "../features/editor/harvyOrderedList";
import { HarvyListKeyboard } from "../features/editor/harvyListKeyboard";
import { LinkEditorSelectionHighlight } from "../features/editor/linkEditorSelectionHighlight";
import { HarvyMarkdownShortcuts } from "../features/editor/harvyMarkdownShortcuts";
import { PlainTextPaste } from "../features/editor/plainTextPaste";
import { HarvyOutlineParagraph } from "../features/outline/harvyOutlineParagraph";
import type { SidebarToolsMode } from "../features/sidebar/sidebarToolsMode";

type EditorCanvasProps = {
  mode: SidebarToolsMode;
  documentTitle: string;
  /** Stored document (Markdown or legacy HTML). */
  text: string;
  /** When opening a file, used to choose Markdown vs plain vs HTML. */
  contentSourcePath?: string | null;
  /** Substack-style in-document title (not the file name). */
  postTitle?: string;
  subtitle?: string;
  showPostTitle?: boolean;
  showSubtitle?: boolean;
  onChangePostTitle?: (value: string) => void;
  onChangeSubtitle?: (value: string) => void;
  placeholder?: string;
  isEditable: boolean;
  /** When true, sets `spellcheck` on the ProseMirror root (native wavy underlines). Shell should gate Edit tab + panel + user pref. */
  spellcheckEnabled: boolean;
  grammarChecksEnabled: boolean;
  showReadabilityHighlights: boolean;
  /** Mechanics dotted underlines — visible only when the Edit sidebar is open. */
  showMechanicsUnderlines: boolean;
  /** When true, Backspace and arrow keys are ignored (Focus mode). */
  blockBackspace?: boolean;
  /** Focus mode presentation: hidden caret, hidden mouse cursor. */
  focusModeActive?: boolean;
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
  /** When on, two-finger click (context menu) on Title or Subtitle opens Suggest titles. */
  showTitleGeneration?: boolean;
  headlinesRunning?: boolean;
  headlinesError?: string | null;
  headlinePairs?: HeadlinePair[];
  selectedHeadlineIndex?: number | null;
  onGenerateHeadlines?: () => void | Promise<void>;
  onSelectHeadlinePair?: (pair: HeadlinePair, index: number) => void;
  /** Visual inactive mode — hides caret/selection until user clicks the writing surface. */
  editorVisuallyInactive?: boolean;
  /** When true, block focus until the user clicks the writing surface. */
  editorFocusSuppressedRef?: RefObject<boolean>;
  onEditorUserActivated?: () => void;
};

export function EditorCanvas({
  mode: _mode,
  documentTitle,
  text,
  contentSourcePath = null,
  postTitle = "",
  subtitle = "",
  showPostTitle = true,
  showSubtitle = true,
  onChangePostTitle,
  onChangeSubtitle,
  placeholder,
  isEditable,
  spellcheckEnabled,
  grammarChecksEnabled,
  showReadabilityHighlights,
  showMechanicsUnderlines,
  blockBackspace = false,
  focusModeActive = false,
  onChangeText,
  onEditorReady,
  onTypingActivity,
  workspaceRootPath = null,
  pickLocalImage,
  loadImageAt,
  onInsertImage,
  showTitleGeneration = false,
  headlinesRunning = false,
  headlinesError = null,
  headlinePairs = [],
  selectedHeadlineIndex = null,
  onGenerateHeadlines,
  onSelectHeadlinePair,
  editorVisuallyInactive = false,
  editorFocusSuppressedRef,
  onEditorUserActivated,
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
  const onEditorUserActivatedRef = useRef(onEditorUserActivated);
  onEditorUserActivatedRef.current = onEditorUserActivated;
  const blockBackspaceRef = useRef(blockBackspace);
  blockBackspaceRef.current = blockBackspace;
  const writingSurfaceRef = useRef<HTMLDivElement | null>(null);
  const dropInFlightRef = useRef(false);
  const [headlineMenuOpen, setHeadlineMenuOpen] = useState(false);
  const [headlineAnchorEl, setHeadlineAnchorEl] = useState<HTMLElement | null>(null);
  const [headlineMountEl, setHeadlineMountEl] = useState<HTMLElement | null>(null);

  const closeHeadlineMenu = useCallback(() => {
    setHeadlineMenuOpen(false);
  }, []);

  const openHeadlineMenu = useCallback(
    (el: HTMLElement) => {
      if (!isEditable || !showTitleGeneration) return;
      closeHarvyContextMenu();
      setHeadlineAnchorEl(el);
      setHeadlineMountEl(writingSurfaceRef.current);
      setHeadlineMenuOpen(true);
    },
    [isEditable, showTitleGeneration],
  );

  useEffect(() => {
    if (!showTitleGeneration || !isEditable) setHeadlineMenuOpen(false);
  }, [showTitleGeneration, isEditable]);

  const editorFocusControl = useMemo<EditorCanvasFocusControl>(
    () => ({
      isFocusSuppressed: () => editorFocusSuppressedRef?.current ?? false,
      onUserActivate: () => onEditorUserActivatedRef.current?.(),
    }),
    [editorFocusSuppressedRef],
  );

  const editor = useEditor(
    {
      immediatelyRender: true,
      autofocus: false,
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
        FocusModeGuards,
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
        PlainTextPaste,
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
            "editor-content ProseMirror-harvy block min-h-full w-full max-w-none resize-none bg-transparent pb-10 pt-1 font-normal text-ink caret-muted outline-none focus:outline-none placeholder:text-ink/45 sm:pb-11 sm:pt-1.5 " +
            (isEditable ? "cursor-text" : "cursor-default select-text opacity-75"),
        },
        handleKeyDown: (view, event) => {
          if (blockBackspaceRef.current && isFocusModeBlockedKey(event.key)) {
            event.preventDefault();
            return true;
          }
          return handleBackspaceOnEmptyTextBlockKeyDown(view, event);
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

  /**
   * Re-hydrate when the buffer has Markdown images but the live doc has no image
   * nodes (e.g. tab left open across a hydration fix, or legacy spaced-path `![]()`).
   */
  useEffect(() => {
    if (!editor) return;
    if (!contentSourcePath) return;
    if (!/!(\[|\\\[).{0,200}(\]|\\\])\([^)\n]+\)/.test(text)) return;
    let hasImageNode = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "harvyImage") {
        hasImageNode = true;
        return false;
      }
    });
    if (hasImageNode) return;
    editor.commands.setContent(toEditorHtml(text, { sourcePath: contentSourcePath }), false);
  }, [editor, text, contentSourcePath]);

  useEffect(() => {
    if (!editor) return;
    editor.storage.focusModeGuards.enabled = blockBackspace;
  }, [editor, blockBackspace]);

  useEffect(() => {
    if (!editor) return;
    editor.view.dom.classList.toggle("harvy-focus-mode-editor", focusModeActive);
  }, [editor, focusModeActive]);

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
    editor.view.dom.classList.toggle("harvy-editor-visually-inactive", editorVisuallyInactive);
  }, [editor, editorVisuallyInactive]);

  useEffect(() => {
    if (!editor) return;
    const prior = editor.options.editorProps?.handleDOMEvents ?? {};
    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        handleDrop: (_view, event, _slice, moved) => {
          if (moved) return false;
          if (!isEditableRef.current) return false;
          const dt = event.dataTransfer;
          if (!shouldHandleHtmlImageDrop(dt)) return false;
          event.preventDefault();
          if (dropInFlightRef.current) return true;
          dropInFlightRef.current = true;
          const { clientX, clientY } = event;
          void (async () => {
            try {
              const srcs = await resolveImageSrcsFromDataTransfer(dt!, workspaceRootPathRef.current);
              if (srcs.length === 0) return;
              onEditorUserActivatedRef.current?.();
              insertImageSrcsAtClientCoords(editor, srcs, clientX, clientY);
            } finally {
              dropInFlightRef.current = false;
            }
          })();
          return true;
        },
        handleDOMEvents: {
          ...prior,
          dragover: (_view, event) => {
            if (!isEditableRef.current) return false;
            if (!shouldHandleHtmlImageDrop(event.dataTransfer)) return false;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
            return true;
          },
          mousedown: (view, event) => {
            if (isEditableRef.current) {
              handleEditorWritingSurfacePointerDown(event as MouseEvent, editorFocusControl);
            }
            if (handleEditorLinkPointerDown(event as MouseEvent)) return true;
            if (handleImageCaptionLinkPointerDown(event as MouseEvent)) return true;
            if (
              isEditableRef.current &&
              handleEditorCanvasFocusPointerDown(view, event as MouseEvent, editorFocusControl)
            ) {
              return true;
            }
            return prior.mousedown?.(view, event) ?? false;
          },
          focus: (view, event) => {
            if (rejectEditorFocusIfSuppressed(view, editorFocusControl)) return true;
            return prior.focus?.(view, event) ?? false;
          },
          keydown: (view, event) => {
            if (
              editorFocusSuppressedRef?.current &&
              view.hasFocus() &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.altKey
            ) {
              view.dom.blur();
              return true;
            }
            return prior.keydown?.(view, event) ?? false;
          },
          contextmenu: (view, event) => {
            if (!isEditableRef.current) return false;
            return handleEditorContextMenuEvent(view, event as MouseEvent, {
              canInsertImage: Boolean(onInsertImageRef.current),
              onInsertImage: () => onInsertImageRef.current?.(),
              placeCaret: true,
            });
          },
          click: (view, event) => {
            if (!isEditableRef.current) return false;
            if ((event as MouseEvent).button !== 0) return false;
            if (tryOpenSpellingSuggestionPopover(view, event as MouseEvent)) return true;
            return tryOpenMechanicsSuggestionPopover(view, event as MouseEvent);
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
  }, [editor, editorFocusControl, editorFocusSuppressedRef, onInsertImage, isEditable]);

  // OS file drops (Finder) — Tauri provides absolute paths here, not via HTML5 FileList.
  useEffect(() => {
    if (!editor || !isTauriRuntime()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWindow()
      .onDragDropEvent((event) => {
        if (cancelled || !isEditableRef.current) return;
        if (event.payload.type !== "drop") return;

        const { paths, position } = event.payload;
        if (paths.length === 0) return;

        void (async () => {
          const scale = await getCurrentWindow().scaleFactor();
          if (cancelled) return;
          const clientX = position.x / scale;
          const clientY = position.y / scale;

          const surface = writingSurfaceRef.current;
          if (!surface) return;
          const topEl = document.elementFromPoint(clientX, clientY);
          if (!topEl || (!surface.contains(topEl) && topEl !== surface)) return;

          if (dropInFlightRef.current) return;
          dropInFlightRef.current = true;
          try {
            const srcs = await resolveImageSrcsFromPaths(paths, workspaceRootPathRef.current);
            if (cancelled || srcs.length === 0) return;
            onEditorUserActivatedRef.current?.();
            insertImageSrcsAtClientCoords(editor, srcs, clientX, clientY);
          } finally {
            dropInFlightRef.current = false;
          }
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
  }, [editor]);

  // Sidebar image drops (pointer drag) — HTML5 DnD is blocked by Tauri dragDropEnabled.
  useEffect(() => {
    if (!editor) return;

    const onSidebarImageDrop = (event: Event) => {
      if (!isEditableRef.current) return;
      const detail = (event as CustomEvent<SidebarImageDropDetail>).detail;
      if (!detail?.path) return;

      const { path, clientX, clientY } = detail;
      const surface = writingSurfaceRef.current;
      if (!surface) return;
      const topEl = document.elementFromPoint(clientX, clientY);
      if (!topEl || (!surface.contains(topEl) && topEl !== surface)) return;

      if (dropInFlightRef.current) return;
      dropInFlightRef.current = true;
      void (async () => {
        try {
          const src = await resolveFilesystemImageSrc(path, workspaceRootPathRef.current);
          if (!src) return;
          onEditorUserActivatedRef.current?.();
          insertImageSrcsAtClientCoords(editor, [src], clientX, clientY);
        } finally {
          dropInFlightRef.current = false;
        }
      })();
    };

    window.addEventListener(HARVY_SIDEBAR_IMAGE_DROP_EVENT, onSidebarImageDrop);
    return () => window.removeEventListener(HARVY_SIDEBAR_IMAGE_DROP_EVENT, onSidebarImageDrop);
  }, [editor]);

  const handleCanvasMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!editor || !isEditable || event.button !== 0) return;
    if (editor.view.dom.contains(event.target as Node)) return;
    const target = event.target;
    if (target instanceof Element && target.closest(".harvy-doc-header")) return;
    if (target instanceof Element && target.closest(".harvy-context-menu")) return;
    handleEditorWritingSurfacePointerDown(event.nativeEvent, editorFocusControl);
    if (handleEditorCanvasFocusPointerDown(editor.view, event.nativeEvent, editorFocusControl)) {
      event.preventDefault();
    }
  };

  const handleSurfaceDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!isEditable) return;
    if (!shouldHandleHtmlImageDrop(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleSurfaceDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!editor || !isEditable) return;
    if (!shouldHandleHtmlImageDrop(event.dataTransfer)) return;
    // Let ProseMirror handle drops that land on the editor DOM itself.
    if (editor.view.dom.contains(event.target as Node)) return;
    event.preventDefault();
    event.stopPropagation();
    if (dropInFlightRef.current) return;
    dropInFlightRef.current = true;
    const { clientX, clientY } = event;
    const dt = event.dataTransfer;
    void (async () => {
      try {
        const srcs = await resolveImageSrcsFromDataTransfer(dt, workspaceRootPathRef.current);
        if (srcs.length === 0) return;
        onEditorUserActivatedRef.current?.();
        insertImageSrcsAtClientCoords(editor, srcs, clientX, clientY);
      } finally {
        dropInFlightRef.current = false;
      }
    })();
  };

  return (
    <div
      className={`box-border flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent border border-solid border-transparent ${editorVisuallyInactive ? "editor-is-inactive" : ""} ${focusModeActive ? "harvy-focus-mode" : ""}`}
    >
      <div
        ref={writingSurfaceRef}
        className={`relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain ${focusModeActive ? "cursor-none" : isEditable ? "cursor-text" : ""}`}
        onMouseDown={handleCanvasMouseDown}
        onDragOver={handleSurfaceDragOver}
        onDrop={handleSurfaceDrop}
      >
        <div className="flex min-h-full w-full flex-col px-10 pb-52 pt-6 sm:px-14 sm:pb-9 sm:pt-8">
          {showPostTitle || showSubtitle ? (
            <div className="harvy-doc-header shrink-0">
              {showPostTitle ? (
                <>
                  <label htmlFor="harvy-post-title" className="sr-only">
                    Title
                  </label>
                  <textarea
                    id="harvy-post-title"
                    rows={1}
                    value={postTitle}
                    disabled={!isEditable}
                    placeholder="Title"
                    spellCheck={spellcheckEnabled}
                    onChange={(event) => {
                      onChangePostTitle?.(event.target.value);
                      onTypingActivity?.();
                      const el = event.target;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      if (showSubtitle) {
                        document.getElementById("harvy-post-subtitle")?.focus();
                        return;
                      }
                      editor?.commands.focus("start");
                    }}
                    onContextMenu={(event) => {
                      if (!isEditable || !showTitleGeneration) return;
                      event.preventDefault();
                      openHeadlineMenu(event.currentTarget);
                    }}
                    onInput={(event) => {
                      const el = event.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    ref={(el) => {
                      if (!el) return;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    className="harvy-doc-title"
                  />
                </>
              ) : null}
              {showSubtitle ? (
                <>
                  <label htmlFor="harvy-post-subtitle" className="sr-only">
                    Subtitle
                  </label>
                  <textarea
                    id="harvy-post-subtitle"
                    rows={1}
                    value={subtitle}
                    disabled={!isEditable}
                    placeholder="Add a subtitle…"
                    spellCheck={spellcheckEnabled}
                    onChange={(event) => {
                      onChangeSubtitle?.(event.target.value);
                      onTypingActivity?.();
                      const el = event.target;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      editor?.commands.focus("start");
                    }}
                    onContextMenu={(event) => {
                      if (!isEditable || !showTitleGeneration) return;
                      event.preventDefault();
                      openHeadlineMenu(event.currentTarget);
                    }}
                    onInput={(event) => {
                      const el = event.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    ref={(el) => {
                      if (!el) return;
                      el.style.height = "auto";
                      el.style.height = `${el.scrollHeight}px`;
                    }}
                    className={`harvy-doc-subtitle${showPostTitle ? "" : " harvy-doc-subtitle--solo"}`}
                  />
                </>
              ) : null}
            </div>
          ) : null}
          <label htmlFor="harvy-editor" className="sr-only">
            {documentTitle}
          </label>
          <EditorContent editor={editor} className="block min-h-full w-full flex-1 pb-52" />
        </div>
        <HeadlineSuggestMenu
          open={headlineMenuOpen}
          anchorEl={headlineAnchorEl}
          mountEl={headlineMountEl}
          running={headlinesRunning}
          error={headlinesError}
          pairs={headlinePairs}
          selectedIndex={selectedHeadlineIndex}
          onGenerate={() => {
            void onGenerateHeadlines?.();
          }}
          onSelectPair={(pair, index) => {
            closeHeadlineMenu();
            onSelectHeadlinePair?.(pair, index);
          }}
          onClose={closeHeadlineMenu}
        />
      </div>
    </div>
  );
}
