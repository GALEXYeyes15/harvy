import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import type { Editor } from "@tiptap/core";
import { PanelLeft, PanelRight } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  applyResolvedTheme,
  readStoredThemeMode,
  resolveTheme,
  writeStoredThemeMode,
  type ThemeMode,
} from "../theme/themeMode";
import {
  applyAppearanceStyle,
  readStoredAppearanceStyleId,
  writeStoredAppearanceStyleId,
  type AppearanceStyleId,
} from "../theme/appearanceStyles";
import { AboutModal } from "./settings/AboutModal";
import { SettingsModal } from "./settings/SettingsModal";
import { EncouragementToast } from "./EncouragementToast";
import { SidebarLeft } from "./SidebarLeft";
import { ChromeSidebarToggleButton } from "./ChromeSidebarToggleButton";
import { SidebarRight } from "./SidebarRight";
import { EditorToolbar } from "./EditorToolbar";
import { EditorAmbientControls } from "./EditorAmbientControls";
import {
  FOCUS_MODE_DURATION_MS,
  FocusModeModal,
  formatFocusRemaining,
} from "./FocusModeModal";
import {
  enterFocusModeWindowLock,
  exitFocusModeWindowLock,
} from "../features/focus/focusModeWindowLock";
import { EditorCanvas } from "./EditorCanvas";
import { ImagePreviewModal, type ImagePreviewTarget } from "./ImagePreviewModal";
import { FloatingTextMenu } from "./FloatingTextMenu";
import { setSpellingDocumentKey } from "../features/proofread/mechanics/spellingDictionary";
import { syncSpellingContextMenuRef } from "../features/proofread/spellingContextMenuRef";
import { EditorDocumentHeader } from "./EditorDocumentHeader";
import { OpenWindowsBar } from "./OpenWindowsBar";
import { CollectPanel } from "./CollectPanel";
import type { CollectItem } from "../features/collect/collectItems";
import {
  loadPersistedCollectItems,
  savePersistedCollectItems,
} from "../features/collect/collectItemsPersistence";
import { markNotionIdeaStarted } from "../features/notion/notionIdeas";
import { WorkspaceSectionSwitcher } from "./WorkspaceSectionSwitcher";
import { useWindowFullscreen } from "../features/window/useWindowFullscreen";
import {
  TOOLS_SIDEBAR_WIDTH_PX,
  WORKSPACE_SECTION_SWITCHER_WIDTH_PX,
  WORKSPACE_SIDEBAR_WIDTH_PX,
  visibleWorkspaceSections,
  type WorkspaceSection,
} from "../features/workspace/workspaceSection";
import {
  readWorkspaceSettings,
  writeWorkspaceSettings,
} from "../features/workspace/workspaceSettings";
import { useOutliersAutoRefresh } from "../features/outliers/useOutliersAutoRefresh";
import {
  readQuickLinksSettings,
  writeQuickLinksSettings,
} from "../features/quick-links/quickLinksSettings";
import { normalizeQuickLinkUrl } from "../features/quick-links/quickLinks";
import {
  readAiCheckSidebarSettings,
  writeAiCheckSidebarSettings,
} from "../features/sidebar/aiCheckSidebarSettings";
import {
  readCriteriaSidebarSettings,
  writeCriteriaSidebarSettings,
} from "../features/sidebar/criteriaSidebarSettings";
import { SaveAsModal, type SaveAsOrganizeMode } from "./SaveAsModal";
import type { EditorCommand } from "../features/editor/commands";
import { documentTextForStats, ingestTextFileContent } from "../features/editor/documentMarkdown";
import { setFileMenuHandlers } from "../features/menu/fileMenuBridge";
import { setupNativeAppMenu } from "../features/menu/setupNativeAppMenu";
import { setupWindowDragRegions } from "../features/window/setupWindowDragRegions";
import { isEditableKeyboardTarget } from "../lib/isEditableKeyboardTarget";
import { formatHotkeyChord, matchSidebarToggleHotkey } from "../features/settings/hotkeys";
import {
  emitNotesPopoutState,
  listenNotesPopoutRequest,
  listenNotesPopoutUpdate,
  toggleNotesPopoutWindow,
} from "../features/notes/notesPopout";
import { visuallyDeactivateEditor } from "../features/editor/editorCanvasFocus";
import { runEditorFormat, type LinkFormatOptions } from "../features/editor/editorFormatActions";
import { calculateEditorStats } from "../features/editor/stats";
import { pickAndImportWorkspaceImage } from "../features/editor/imageAssets";
import { copyDocumentToClipboard } from "../features/editor/documentClipboard";
import { openSafeExternalUrl } from "../features/editor/openExternalUrl";
import { printDocumentFromEditor } from "../features/editor/documentPrint";
import type { HarvyImageLoadAttrs } from "../features/editor/harvyImageAttribution";
import {
  insertHarvyImagePlaceholderAtCursor,
  loadHarvyImageAt,
} from "../features/editor/insertHarvyImage";
import {
  countSentenceComplexityFromStoredDocument,
  countSentenceComplexityInDoc,
} from "../features/writing-assistance/sentenceComplexityDecorations";
import {
  joinPath,
  parentDirectory,
  resolveParentForNewFolder,
  sanitizeFileBasename,
  splitFileBaseAndExtension,
  validateFolderName,
} from "../features/workspace/folderNaming";
import {
  browsePathFromFolderSegments,
  filterFileTree,
  filterTree,
  findNodeByPath,
  isImagePreviewable,
  isTextPreviewable,
} from "../features/workspace/tree";
import { isPathUnderWorkspaceRoot, normalizeFsPath } from "../features/workspace/workspacePaths";
import {
  loadDocumentNotes,
  renameDocumentNotesSidecar,
  resolveProjectDirectory,
  saveDocumentNotes,
} from "../features/workspace/documentNotes";
import {
  loadDocumentCriteria,
  renameDocumentCriteriaSidecar,
  saveDocumentCriteria,
} from "../features/workspace/documentCriteria";
import { countSpellingWords } from "../features/proofread/mechanics/spellingNormalize";
import { appendTextToDocumentNotes } from "../features/workspace/appendDocumentNotes";
import {
  parseDocumentFrontmatter,
  serializeDocumentWithFrontmatter,
} from "../features/editor/documentFrontmatter";
import type { FileNode, WorkspaceDocument } from "../features/workspace/types";
import { nextActiveTabIdAfterClose, toPageTabs } from "../features/tabs/pageTabs";
import {
  defaultPdfFileName,
  defaultPodcastNotesPdfFileName,
  defaultSaveFileName,
  documentTitleBaseFromSaveAsFileName,
  fileNameFromPath,
  getDocumentMarkdown,
  isMacOSPlatform,
  isTauriRuntime,
  normalizeMarkdownSavePath,
  normalizePdfSavePath,
  resolveSaveAsOutputPath,
  validateSaveAsOutputPath,
} from "../features/save/saveRuntime";
import {
  applyImageSrcRewrites,
  collectEmbeddedImageSrcs,
  packageDocumentImages,
} from "../features/save/documentImages";
import {
  getProjectStructure,
  projectSubfolderPathsToCreate,
} from "../features/save/saveAsFolderPreview";
import {
  readFocusVisibilityPrefs,
  writeFocusVisibilityPrefs,
} from "../features/editor/focusVisibilitySettings";
import {
  readDocumentHeaderPrefs,
  writeDocumentHeaderPrefs,
} from "../features/editor/documentHeaderSettings";
import {
  pickRandomEditorPrompt,
  readEditorPromptPrefs,
  writeEditorPromptPrefs,
} from "../features/editor/editorPromptSettings";
import {
  readEncouragementPrefs,
  writeEncouragementPrefs,
} from "../features/encouragement/encouragementSettings";
import { useEncouragementScheduler } from "../features/encouragement/useEncouragementScheduler";
import {
  readParametersPrefs,
  writeParametersPrefs,
} from "../features/settings/parametersSettings";
import {
  readWritingAssistancePrefs,
  writeWritingAssistancePrefs,
} from "../features/writing-assistance/writingAssistanceSettings";
import {
  isSidebarModeForSection,
  type SidebarToolsMode,
} from "../features/sidebar/sidebarToolsMode";
import { setMechanicsUnderlinesVisible } from "../features/proofread/mechanicsUnderlineLayer";
import {
  grammarDecorationsKey,
  writingAssistanceViewRef,
} from "../features/writing-assistance/writingAssistanceExtension";
import { ensureHunspellLoaded } from "../features/proofread/mechanics/hunspellDictionary";
import { syncMechanicsProofread } from "../features/proofread/mechanics/syncMechanicsProofread";
import type { ProofreadIssue } from "../features/proofread/types";
import { proofreadPlainTextAndPositions } from "../features/proofread/proofreadPlainMap";
import {
  estimateAiCheckCostFromEssay,
  estimateCostUsd,
  formatAiCheckCostUsd,
  formatAiModelDisplayName,
  generatePodcastNotes,
  getAiCheckConfig,
  locateAiIssuesInText,
  runAiCheck,
  type AiCheckConfigPublic,
} from "../features/aiCheck/aiCheck";
import { syncAiCheckPopoverPrefs } from "../features/aiCheck/aiCheckPopoverPrefs";
import { ensureUserRulesFile, loadEditorRules } from "../features/writing-assistance/editorRules";

/** Formatting toolbar (Bold, H1, etc.): hidden for distraction-free writing; set true to restore for Edit chrome. */
const SHOW_FORMATTING_TOOLBAR = false;

/**
 * At this viewport width and above, workspace + readability rails float over the editor (fixed max-width).
 * Narrower windows use flex “push” rails so the editor column shrinks instead of being covered.
 */
const SIDEBAR_OVERLAY_LAYOUT_MIN_PX = 1400;

function useSidebarOverlayLayoutMode(): boolean {
  const [overlay, setOverlay] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(`(min-width: ${SIDEBAR_OVERLAY_LAYOUT_MIN_PX}px)`).matches
      : true,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${SIDEBAR_OVERLAY_LAYOUT_MIN_PX}px)`);
    const onChange = () => setOverlay(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return overlay;
}

/** In-memory tab id for the default unsaved document; must not be passed as a workspace filesystem path. */
const HARVY_DEFAULT_UNTITLED_TAB_ID = "harvy:untitled";

function isVirtualDocumentTabId(id: string | null | undefined): boolean {
  return Boolean(id?.startsWith("harvy:"));
}

function createInitialUntitledWorkspaceDocument(): WorkspaceDocument {
  return {
    id: HARVY_DEFAULT_UNTITLED_TAB_ID,
    title: "Untitled",
    content: "",
    sourcePath: "",
    kind: "text",
    lastSavedContent: "",
    postTitle: "",
    lastSavedPostTitle: "",
    subtitle: "",
    lastSavedSubtitle: "",
    notes: "",
    lastSavedNotes: "",
    criteria: "",
    lastSavedCriteria: "",
  };
}

function createUntitledWorkspaceDocument(id: string): WorkspaceDocument {
  return {
    id,
    title: "Untitled",
    content: "",
    sourcePath: "",
    kind: "text",
    lastSavedContent: "",
    postTitle: "",
    lastSavedPostTitle: "",
    subtitle: "",
    lastSavedSubtitle: "",
    notes: "",
    lastSavedNotes: "",
    criteria: "",
    lastSavedCriteria: "",
  };
}

function isDocumentDirty(doc: WorkspaceDocument): boolean {
  return (
    doc.content !== doc.lastSavedContent ||
    doc.notes !== doc.lastSavedNotes ||
    doc.criteria !== doc.lastSavedCriteria ||
    doc.postTitle !== doc.lastSavedPostTitle ||
    doc.subtitle !== doc.lastSavedSubtitle
  );
}

function markdownForDisk(body: string, doc: WorkspaceDocument | null | undefined): string {
  return serializeDocumentWithFrontmatter(body, {
    postTitle: doc?.postTitle ?? "",
    subtitle: doc?.subtitle ?? "",
  });
}

function getFolderSegmentsRelativeToRoot(rootPath: string, targetPath: string): string[] | null {
  const normalize = (value: string) => value.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedRoot = normalize(rootPath);
  const normalizedTarget = normalize(targetPath);

  if (!normalizedRoot) return null;
  if (normalizedTarget === normalizedRoot) return [];

  const prefix = `${normalizedRoot}/`;
  if (!normalizedTarget.startsWith(prefix)) return null;
  return normalizedTarget.slice(prefix.length).split("/").filter(Boolean);
}

export function AppShell() {
  const sidebarOverlayLayout = useSidebarOverlayLayoutMode();
  const isWindowFullscreen = useWindowFullscreen();
  const workspaceSidebarToggleLeft = isWindowFullscreen
    ? "0.5rem"
    : "calc(var(--harvy-traffic-light-inset, 0px) + 0.5rem)";
  const [workspaceRootPath, setWorkspaceRootPath] = useState<string | null>(null);
  const [workspaceTree, setWorkspaceTree] = useState<FileNode | null>(null);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [openDocuments, setOpenDocuments] = useState<Record<string, WorkspaceDocument>>(
    () => ({ [HARVY_DEFAULT_UNTITLED_TAB_ID]: createInitialUntitledWorkspaceDocument() }),
  );
  /** Active page tab id (document id; real files use their path, in-memory tabs use `harvy:` ids). */
  const [activeTabId, setActiveTabId] = useState<string | null>(() => HARVY_DEFAULT_UNTITLED_TAB_ID);
  /** Left-to-right order of open tabs; each id must exist in `openDocuments` while the tab is open. */
  const [openTabIds, setOpenTabIds] = useState<string[]>(() => [HARVY_DEFAULT_UNTITLED_TAB_ID]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<SidebarToolsMode>("notes");
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState<WorkspaceSection>("write");
  /** After Research’s first paint, animate padding with sidebar toggles. */
  const [collectPaddingAnimated, setCollectPaddingAnimated] = useState(false);
  const [enableCollect, setEnableCollect] = useState(() => readWorkspaceSettings().enableCollect);
  const [showOutliersView, setShowOutliersView] = useState(
    () => readWorkspaceSettings().showOutliersView,
  );
  const [showCollectView, setShowCollectView] = useState(
    () => readWorkspaceSettings().showCollectView,
  );
  const [showAvatarView, setShowAvatarView] = useState(
    () => readWorkspaceSettings().showAvatarView,
  );
  const [collectItems, setCollectItems] = useState<CollectItem[]>(() => loadPersistedCollectItems());
  const [isWorkspaceSidebarOpen, setIsWorkspaceSidebarOpen] = useState(true);
  /** `null` = browse at the selected workspace root. */
  const [workspaceBrowsePath, setWorkspaceBrowsePath] = useState<string | null>(null);
  /** Folder names under the workspace root — excludes volume label. */
  const [breadcrumbFolderSegments, setBreadcrumbFolderSegments] = useState<string[]>([]);
  /** Resolved system volume name (desktop), or generic label on web. */
  const [workspaceVolumeLabel, setWorkspaceVolumeLabel] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [focusSessionEndsAt, setFocusSessionEndsAt] = useState<number | null>(null);
  const [focusRemainingMs, setFocusRemainingMs] = useState(0);
  const [imagePreview, setImagePreview] = useState<ImagePreviewTarget | null>(null);
  const [saveAsModalOpen, setSaveAsModalOpen] = useState(false);
  const [saveAsLiveFileName, setSaveAsLiveFileName] = useState("");
  const [saveAsInitialFileName, setSaveAsInitialFileName] = useState("Untitled.md");
  const [saveAsDestinationPath, setSaveAsDestinationPath] = useState<string | null>(null);
  const [saveAsSubmitting, setSaveAsSubmitting] = useState(false);
  /** Regular document Save As vs podcast-notes export (forces Folder + writes PDF to Exports). */
  const [saveAsPurpose, setSaveAsPurpose] = useState<"document" | "podcast-notes">("document");
  const [isTopChromeHidden, setIsTopChromeHidden] = useState(false);
  const [readabilityPanelOpen, setReadabilityPanelOpen] = useState(true);
  const [showQuickLinks, setShowQuickLinks] = useState(
    () => readQuickLinksSettings().showQuickLinks,
  );
  const [showCriteria, setShowCriteria] = useState(
    () => readCriteriaSidebarSettings().showCriteria,
  );
  const [publishUrl, setPublishUrl] = useState(
    () => readCriteriaSidebarSettings().publishUrl,
  );
  const [showAiCheck, setShowAiCheck] = useState(
    () => readAiCheckSidebarSettings().showAiCheck,
  );
  /** In-memory buffer when no tabs open — not a saved file until persistence exists. */
  const [scratchDraftContent, setScratchDraftContent] = useState("");
  /** When set, scratch buffer last wrote to this path. */
  const [scratchDiskPath, setScratchDiskPath] = useState<string | null>(null);
  /** Scratch Markdown last successfully written to `scratchDiskPath` (or "" before first save). */
  const [scratchLastSavedContent, setScratchLastSavedContent] = useState("");
  /** Display name for the scratch buffer (no tab row); shown in the document header. */
  const [scratchDocumentTitle, setScratchDocumentTitle] = useState("Untitled");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredThemeMode());
  const [appearanceStyleId, setAppearanceStyleId] = useState<AppearanceStyleId>(
    () => readStoredAppearanceStyleId(),
  );
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false,
  );

  const [writingAssistancePrefs, setWritingAssistancePrefs] = useState(readWritingAssistancePrefs);
  const [focusVisibilityPrefs, setFocusVisibilityPrefs] = useState(readFocusVisibilityPrefs);
  const [documentHeaderPrefs, setDocumentHeaderPrefs] = useState(readDocumentHeaderPrefs);
  const [editorPromptPrefs, setEditorPromptPrefs] = useState(readEditorPromptPrefs);
  const [sessionEditorPrompt] = useState(() =>
    pickRandomEditorPrompt(editorPromptPrefs.prompts),
  );
  const [encouragementPrefs, setEncouragementPrefs] = useState(readEncouragementPrefs);
  const [parametersPrefs, setParametersPrefs] = useState(readParametersPrefs);
  const { activePhrase: encouragementPhrase, dismiss: dismissEncouragement, showTest: testEncouragement } =
    useEncouragementScheduler(encouragementPrefs);

  const [tiptapEditor, setTiptapEditor] = useState<Editor | null>(null);
  const [selectedWordCount, setSelectedWordCount] = useState<number | null>(null);
  const [proofreadIssues, setProofreadIssues] = useState<ProofreadIssue[]>([]);
  const [aiCheckConfig, setAiCheckConfig] = useState<AiCheckConfigPublic | null>(null);
  const [aiProofreadIssues, setAiProofreadIssues] = useState<ProofreadIssue[]>([]);
  const [aiCheckRunning, setAiCheckRunning] = useState(false);
  const [podcastNotesRunning, setPodcastNotesRunning] = useState(false);
  const [aiCheckCostLabel, setAiCheckCostLabel] = useState<string | null>(null);
  const [aiCheckError, setAiCheckError] = useState<string | null>(null);
  const aiProofreadIssuesRef = useRef<ProofreadIssue[]>([]);
  /** Sidebar inline rename for a newly created (or future: any) folder. */
  const [folderRename, setFolderRename] = useState<{
    path: string;
    draft: string;
    originalBasename: string;
  } | null>(null);
  const folderRenameRef = useRef<{
    path: string;
    draft: string;
    originalBasename: string;
  } | null>(null);
  const skipFolderRenameCommitRef = useRef(false);

  useEffect(() => {
    folderRenameRef.current = folderRename;
  }, [folderRename]);

  useEffect(() => {
    if (!isTauriRuntime() || !isMacOSPlatform()) return;
    document.documentElement.classList.add("harvy-macos-overlay-titlebar");
    return () => {
      document.documentElement.classList.remove("harvy-macos-overlay-titlebar");
    };
  }, []);

  const [editorVisuallyInactive, setEditorVisuallyInactive] = useState(false);
  const editorFocusSuppressedRef = useRef(false);
  const editorFocusBeforeSaveAsRef = useRef<boolean | null>(null);

  const setEditorInactive = useCallback((inactive: boolean) => {
    editorFocusSuppressedRef.current = inactive;
    setEditorVisuallyInactive(inactive);
  }, []);

  const handleEditorReady = useCallback((ed: Editor | null) => {
    setTiptapEditor(ed);
  }, []);

  const handleEditorUserActivated = useCallback(() => {
    setEditorInactive(false);
  }, [setEditorInactive]);

  const handleWorkspaceSectionChange = useCallback(
    (section: WorkspaceSection) => {
      if (section !== "write") {
        setEditorInactive(true);
        visuallyDeactivateEditor(tiptapEditor);
      }
      if (section === "collect") {
        setReadabilityPanelOpen(false);
        setCollectPaddingAnimated(false);
      }
      setActiveWorkspaceSection(section);
    },
    [setEditorInactive, tiptapEditor],
  );

  useLayoutEffect(() => {
    if (activeWorkspaceSection !== "collect") {
      setCollectPaddingAnimated(false);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      setCollectPaddingAnimated(true);
    });
    return () => window.cancelAnimationFrame(id);
  }, [activeWorkspaceSection]);

  const handleEnableCollectChange = useCallback((enabled: boolean) => {
    setEnableCollect(enabled);
    writeWorkspaceSettings({ enableCollect: enabled });
    if (!enabled) {
      setActiveWorkspaceSection("write");
    }
  }, []);

  const applyCollectViewVisibility = useCallback((next: {
    showOutliersView: boolean;
    showCollectView: boolean;
    showAvatarView: boolean;
  }) => {
    setShowOutliersView(next.showOutliersView);
    setShowCollectView(next.showCollectView);
    setShowAvatarView(next.showAvatarView);
  }, []);

  const handleShowOutliersViewChange = useCallback(
    (enabled: boolean) => {
      applyCollectViewVisibility(writeWorkspaceSettings({ showOutliersView: enabled }));
    },
    [applyCollectViewVisibility],
  );

  const handleShowCollectViewChange = useCallback(
    (enabled: boolean) => {
      applyCollectViewVisibility(writeWorkspaceSettings({ showCollectView: enabled }));
    },
    [applyCollectViewVisibility],
  );

  const handleShowAvatarViewChange = useCallback(
    (enabled: boolean) => {
      applyCollectViewVisibility(writeWorkspaceSettings({ showAvatarView: enabled }));
    },
    [applyCollectViewVisibility],
  );

  const handleShowQuickLinksChange = useCallback((enabled: boolean) => {
    const next = writeQuickLinksSettings({ showQuickLinks: enabled });
    setShowQuickLinks(next.showQuickLinks);
  }, []);

  const handleShowCriteriaChange = useCallback((enabled: boolean) => {
    const next = writeCriteriaSidebarSettings({ showCriteria: enabled });
    setShowCriteria(next.showCriteria);
    if (!next.showCriteria) {
      setMode((current) => (current === "criteria" ? "notes" : current));
    }
  }, []);

  const handlePublishUrlChange = useCallback((value: string) => {
    const next = writeCriteriaSidebarSettings({ publishUrl: value });
    setPublishUrl(next.publishUrl);
  }, []);

  const handleShowAiCheckChange = useCallback((enabled: boolean) => {
    const next = writeAiCheckSidebarSettings({ showAiCheck: enabled });
    setShowAiCheck(next.showAiCheck);
  }, []);

  const showWorkspaceNavigation = enableCollect;

  useOutliersAutoRefresh(enableCollect && showOutliersView);

  const workspaceSections = useMemo(
    () => visibleWorkspaceSections(enableCollect),
    [enableCollect],
  );

  useEffect(() => {
    if (!enableCollect) {
      setActiveWorkspaceSection("write");
    }
  }, [enableCollect]);

  useEffect(() => {
    if (!isSidebarModeForSection(mode, activeWorkspaceSection)) {
      setMode("notes");
      return;
    }
    if (mode === "criteria" && !showCriteria) {
      setMode("notes");
    }
  }, [activeWorkspaceSection, mode, showCriteria]);

  useEffect(() => {
    if (activeWorkspaceSection !== "write") return;
    if (!editorFocusSuppressedRef.current) return;
    if (saveAsModalOpen) return;

    const ed = tiptapEditor;
    if (!ed) return;

    const deactivate = () => visuallyDeactivateEditor(ed);
    deactivate();
    const raf = requestAnimationFrame(deactivate);
    const timer = window.setTimeout(deactivate, 0);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [activeWorkspaceSection, tiptapEditor, saveAsModalOpen]);

  const handleSpellcheckPref = useCallback((spellcheck: boolean) => {
    setWritingAssistancePrefs(writeWritingAssistancePrefs({ spellcheck }));
  }, []);

  const handleFocusVisibilityPrefChange = useCallback(
    (partial: Parameters<typeof writeFocusVisibilityPrefs>[0]) => {
      setFocusVisibilityPrefs(writeFocusVisibilityPrefs(partial));
    },
    [],
  );

  const handleDocumentHeaderPrefChange = useCallback(
    (partial: Parameters<typeof writeDocumentHeaderPrefs>[0]) => {
      setDocumentHeaderPrefs(writeDocumentHeaderPrefs(partial));
    },
    [],
  );

  const handleEditorPromptPrefsChange = useCallback(
    (partial: Parameters<typeof writeEditorPromptPrefs>[0]) => {
      setEditorPromptPrefs(writeEditorPromptPrefs(partial));
    },
    [],
  );

  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  const handleEncouragementPrefsChange = useCallback(
    (partial: Parameters<typeof writeEncouragementPrefs>[0]) => {
      setEncouragementPrefs(writeEncouragementPrefs(partial));
    },
    [],
  );

  const handleParametersPrefsChange = useCallback(
    (partial: Parameters<typeof writeParametersPrefs>[0]) => {
      setParametersPrefs(writeParametersPrefs(partial));
    },
    [],
  );

  const focusModeActive = focusSessionEndsAt != null;

  const hideTopBarWhileTyping =
    focusModeActive ||
    (isTopChromeHidden && !focusVisibilityPrefs.keepTopBarVisibleWhileTyping);
  const hideDocumentTitleWhileTyping =
    focusModeActive ||
    (isTopChromeHidden && !focusVisibilityPrefs.keepDocumentTitleVisibleWhileTyping);
  const hideBottomToolsWhileTyping =
    isTopChromeHidden && !focusVisibilityPrefs.keepBottomToolsVisibleWhileTyping;
  /** Collect/Write rail: always hidden in Focus mode; otherwise follows typing chrome. */
  const hideWorkspaceSectionRail = focusModeActive || isTopChromeHidden;
  const openTabIdsRef = useRef(openTabIds);
  const activeTabIdRef = useRef(activeTabId);
  const handleCreateMarkdownFileRef = useRef<() => Promise<void>>(async () => {});
  openTabIdsRef.current = openTabIds;
  activeTabIdRef.current = activeTabId;

  const editorTypingActivityHandlerRef = useRef<(() => void) | null>(null);
  const bothSidebarsClosed = !isWorkspaceSidebarOpen && !readabilityPanelOpen;

  const emitEditorTypingActivity = useCallback(() => {
    if (bothSidebarsClosed) {
      setIsTopChromeHidden(true);
    }
    editorTypingActivityHandlerRef.current?.();
  }, [bothSidebarsClosed]);

  const toggleLeftSidebar = useCallback(() => {
    if (focusModeActive) return;
    setIsWorkspaceSidebarOpen((open) => !open);
  }, [focusModeActive]);

  const toggleRightSidebar = useCallback(() => {
    if (focusModeActive) return;
    setReadabilityPanelOpen((open) => !open);
  }, [focusModeActive]);

  /** Bottom bar: snap both rails to the same state — both on unless both already on, then both off. */
  const toggleBothSidebars = useCallback(() => {
    if (focusModeActive) return;
    if (isWorkspaceSidebarOpen && readabilityPanelOpen) {
      setIsWorkspaceSidebarOpen(false);
      setReadabilityPanelOpen(false);
    } else {
      setIsWorkspaceSidebarOpen(true);
      setReadabilityPanelOpen(true);
    }
  }, [focusModeActive, isWorkspaceSidebarOpen, readabilityPanelOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = matchSidebarToggleHotkey(event);
      if (!action) return;
      const el = event.target as HTMLElement | null;
      if (el?.closest('[role="dialog"]')) return;
      if (el?.closest("[data-floating-text-menu]")) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === "left") toggleLeftSidebar();
      else if (action === "right") toggleRightSidebar();
      else toggleBothSidebars();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [toggleLeftSidebar, toggleRightSidebar, toggleBothSidebars]);

  const startFocusMode = useCallback(() => {
    setIsWorkspaceSidebarOpen(false);
    setReadabilityPanelOpen(false);
    setIsTopChromeHidden(true);
    setFocusSessionEndsAt(Date.now() + FOCUS_MODE_DURATION_MS);
    void enterFocusModeWindowLock().catch((err) =>
      console.error("Focus mode window lock:", err),
    );
  }, []);

  const endFocusMode = useCallback(() => {
    setFocusSessionEndsAt(null);
    setFocusRemainingMs(0);
    void exitFocusModeWindowLock().catch((err) =>
      console.error("Focus mode window unlock:", err),
    );
  }, []);

  useEffect(() => {
    if (focusSessionEndsAt == null) return;

    const tick = () => {
      const remaining = focusSessionEndsAt - Date.now();
      if (remaining <= 0) {
        endFocusMode();
        return;
      }
      setFocusRemainingMs(remaining);
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [focusSessionEndsAt, endFocusMode]);

  /** While Focus mode runs, keep both rails closed even if something tries to reopen them. */
  useEffect(() => {
    if (!focusModeActive) return;
    if (isWorkspaceSidebarOpen) setIsWorkspaceSidebarOpen(false);
    if (readabilityPanelOpen) setReadabilityPanelOpen(false);
    if (!isTopChromeHidden) setIsTopChromeHidden(true);
  }, [focusModeActive, isWorkspaceSidebarOpen, readabilityPanelOpen, isTopChromeHidden]);

  /** Esc ends Focus mode when no overlay dialog is open. Block common leave shortcuts. */
  useEffect(() => {
    if (!focusModeActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isFocusModeOpen || isSettingsOpen || isAboutOpen || saveAsModalOpen) return;
        event.preventDefault();
        endFocusMode();
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      // Soft-block in-app quit/hide/close shortcuts (OS Cmd+Tab still works).
      if (key === "w" || key === "q" || key === "h" || key === "m") {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    focusModeActive,
    isFocusModeOpen,
    isSettingsOpen,
    isAboutOpen,
    saveAsModalOpen,
    endFocusMode,
  ]);

  useEffect(() => {
    if (focusModeActive) return;
    if (!bothSidebarsClosed) {
      setIsTopChromeHidden(false);
    }
  }, [bothSidebarsClosed, focusModeActive]);

  useEffect(() => {
    if (focusModeActive || !bothSidebarsClosed) return;
    const onPointerMove = () => {
      setIsTopChromeHidden(false);
    };
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    return () => window.removeEventListener("mousemove", onPointerMove);
  }, [bothSidebarsClosed, focusModeActive]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemPrefersDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme = useMemo(
    () => resolveTheme(themeMode, systemPrefersDark),
    [themeMode, systemPrefersDark],
  );

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
    applyAppearanceStyle(appearanceStyleId, resolvedTheme);
  }, [resolvedTheme, appearanceStyleId]);

  useEffect(() => {
    writeStoredThemeMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    writeStoredAppearanceStyleId(appearanceStyleId);
  }, [appearanceStyleId]);

  const reloadWorkspaceTree = useCallback(async (): Promise<FileNode | null> => {
    if (!isTauriRuntime()) {
      setWorkspaceTree(null);
      return null;
    }
    setIsLoadingTree(true);
    setWorkspaceError(null);
    try {
      const tree = await invoke<FileNode>("get_workspace_tree");
      setWorkspaceTree(tree);
      return tree;
    } catch (error) {
      setWorkspaceError(
        `Could not load workspace. ${error instanceof Error ? error.message : String(error)}`,
      );
      setWorkspaceTree(null);
      return null;
    } finally {
      setIsLoadingTree(false);
    }
  }, []);

  const chooseWorkspaceFolder = useCallback(async () => {
    if (!isTauriRuntime()) {
      window.alert("Choosing a workspace folder requires the Harvy desktop app.");
      return;
    }
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Choose workspace folder",
        defaultPath: workspaceRootPath ?? undefined,
      });
      if (typeof selected !== "string") return;
      const root = await invoke<string>("set_workspace_root", { path: selected });
      setWorkspaceRootPath(root);
      setWorkspaceBrowsePath(null);
      setBreadcrumbFolderSegments([]);
      setExpandedPaths(new Set());
      const tree = await reloadWorkspaceTree();
      if (tree) setSelectedPath(tree.path);
    } catch (error) {
      window.alert(
        `Could not choose workspace folder. ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [workspaceRootPath, reloadWorkspaceTree]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    void (async () => {
      setIsLoadingTree(true);
      try {
        const root = await invoke<string | null>("get_workspace_root");
        if (cancelled) return;
        if (!root) {
          setWorkspaceRootPath(null);
          setWorkspaceTree(null);
          setIsLoadingTree(false);
          return;
        }
        setWorkspaceRootPath(root);
        const tree = await reloadWorkspaceTree();
        if (cancelled || !tree) return;
        setExpandedPaths(new Set());
        setSelectedPath(tree.path);
        setBreadcrumbFolderSegments([]);
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(
            `Could not load workspace. ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } finally {
        if (!cancelled) setIsLoadingTree(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadWorkspaceTree]);

  const supportedTree = useMemo(() => {
    if (!workspaceTree) return null;
    return { ...workspaceTree, children: filterFileTree(workspaceTree.children ?? []) };
  }, [workspaceTree]);

  const filteredTree = useMemo(
    () => (supportedTree ? filterTree(supportedTree, searchQuery) : null),
    [supportedTree, searchQuery],
  );

  const hasWorkspaceFolder = Boolean(workspaceRootPath && supportedTree);

  const workspaceListRoots = useMemo(() => {
    const base = filteredTree ?? supportedTree;
    if (!base) return [];
    const anchor =
      workspaceBrowsePath === null
        ? base
        : findNodeByPath(base, workspaceBrowsePath) ??
          (supportedTree ? findNodeByPath(supportedTree, workspaceBrowsePath) : null);
    if (!anchor || anchor.kind !== "directory") return [];
    return filterFileTree(anchor.children ?? []);
  }, [filteredTree, supportedTree, workspaceBrowsePath]);

  const breadcrumbAnchorPath = workspaceBrowsePath ?? supportedTree?.path ?? null;

  useEffect(() => {
    if (!breadcrumbAnchorPath) {
      setWorkspaceVolumeLabel(null);
      return;
    }
    if (!isTauriRuntime()) {
      setWorkspaceVolumeLabel(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const name = await invoke<string>("get_volume_display_name_for_path", {
          path: breadcrumbAnchorPath,
        });
        if (!cancelled) setWorkspaceVolumeLabel(name.trim() || null);
      } catch {
        if (!cancelled) setWorkspaceVolumeLabel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [breadcrumbAnchorPath]);

  /** Keep browse/selection paths inside the selected workspace root. */
  useEffect(() => {
    if (!supportedTree) return;
    const root = supportedTree.path;
    setWorkspaceBrowsePath((w) => {
      if (w != null && !isPathUnderWorkspaceRoot(root, w)) return null;
      return w;
    });
    setSelectedPath((s) => (!s || !isPathUnderWorkspaceRoot(root, s) ? root : s));
  }, [supportedTree?.path]);

  /** When browse is at root (`null`), breadcrumb segments must be empty. */
  useEffect(() => {
    if (!supportedTree) return;
    if (workspaceBrowsePath !== null) return;
    setBreadcrumbFolderSegments([]);
  }, [workspaceBrowsePath, supportedTree?.path]);

  const breadcrumbVolumeFirst = workspaceVolumeLabel?.trim() || "Local Drive";
  const breadcrumbRootDisplayLabel = supportedTree?.name?.trim() || "Workspace";

  const navigateBreadcrumbDisplayIndex = useCallback(
    (displayIndex: number) => {
      if (!supportedTree) return;
      const next = breadcrumbFolderSegments.slice(0, displayIndex);
      setBreadcrumbFolderSegments(next);
      const path = browsePathFromFolderSegments(supportedTree, next);
      setWorkspaceBrowsePath(path);
      setSelectedPath(path ?? supportedTree.path);
      setExpandedPaths(new Set());
    },
    [supportedTree, breadcrumbFolderSegments],
  );

  function openWorkspaceFolder(node: FileNode) {
    if (node.kind !== "directory") return;
    if (!supportedTree) return;
    const relative = getFolderSegmentsRelativeToRoot(supportedTree.path, node.path);
    if (!relative) {
      // Guard against any path outside the allowed workspace root.
      setWorkspaceBrowsePath(null);
      setBreadcrumbFolderSegments([]);
      setSelectedPath(supportedTree.path);
      return;
    }
    setWorkspaceBrowsePath(relative.length === 0 ? null : node.path);
    setBreadcrumbFolderSegments(relative);
    setExpandedPaths(new Set());
    setSelectedPath(node.path);
  }

  /** Step up one breadcrumb level (same as choosing the parent segment). */
  function closeWorkspaceOneLevel() {
    if (breadcrumbFolderSegments.length === 0 || !supportedTree) return;
    navigateBreadcrumbDisplayIndex(breadcrumbFolderSegments.length - 1);
  }

  const activeDocument = activeTabId ? openDocuments[activeTabId] : null;
  const scratchEditorBody =
    activeDocument?.content ?? (openTabIds.length === 0 ? scratchDraftContent : "");

  const isDirty = useMemo(() => {
    if (activeTabId && activeDocument) {
      return isDocumentDirty(activeDocument);
    }
    if (openTabIds.length === 0) {
      return scratchDraftContent !== scratchLastSavedContent;
    }
    return false;
  }, [
    activeTabId,
    activeDocument,
    openTabIds.length,
    scratchDraftContent,
    scratchLastSavedContent,
  ]);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const focusModeActiveRef = useRef(focusModeActive);
  focusModeActiveRef.current = focusModeActive;

  const editorEditable = Boolean(activeDocument) || openTabIds.length === 0;

  const stats = useMemo(() => {
    const text = documentTextForStats(scratchEditorBody);
    const sentenceComplexity = tiptapEditor
      ? countSentenceComplexityInDoc(tiptapEditor.state.doc)
      : countSentenceComplexityFromStoredDocument(scratchEditorBody, activeDocument?.sourcePath ?? null);
    return calculateEditorStats(text, sentenceComplexity, parametersPrefs.readingWordsPerMinute);
  }, [
    scratchEditorBody,
    tiptapEditor,
    activeDocument?.sourcePath,
    parametersPrefs.readingWordsPerMinute,
    parametersPrefs.fkComplexityThreshold,
  ]);

  useEffect(() => {
    // Initialize persisted rules file early so future edits always target user-owned rules.
    void (async () => {
      try {
        await ensureUserRulesFile();
        await loadEditorRules();
      } catch (err) {
        console.warn("Failed to initialize user editor rules; using bundled defaults.", err);
      }
    })();
  }, []);
  const openTabs = useMemo(() => toPageTabs(openTabIds, openDocuments), [openTabIds, openDocuments]);

  useEffect(() => {
    const ed = tiptapEditor;
    if (!ed) return;
    const syncSelectedWords = () => {
      if (!ed.isFocused) {
        setSelectedWordCount(null);
        return;
      }
      const { empty, from, to } = ed.state.selection;
      if (empty) {
        setSelectedWordCount(null);
        return;
      }
      const slice = ed.state.doc.textBetween(from, to, "\n", "\0");
      setSelectedWordCount(countSpellingWords(slice));
    };
    ed.on("selectionUpdate", syncSelectedWords);
    ed.on("transaction", syncSelectedWords);
    return () => {
      ed.off("selectionUpdate", syncSelectedWords);
      ed.off("transaction", syncSelectedWords);
    };
  }, [tiptapEditor]);

  const setActiveTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const createUntitledTab = useCallback(() => {
    const id = `harvy:untitled:${Math.random().toString(36).slice(2, 10)}`;
    const nextDoc = createUntitledWorkspaceDocument(id);
    setOpenDocuments((prev) => ({ ...prev, [id]: nextDoc }));
    setOpenTabIds((prev) => [...prev, id]);
    setActiveTabId(id);
  }, []);

  function updateActiveDocumentContent(nextValue: string) {
    if (activeTabId) {
      setOpenDocuments((prev) => {
        const current = prev[activeTabId];
        if (!current) return prev;
        return { ...prev, [activeTabId]: { ...current, content: nextValue } };
      });
      return;
    }
    if (openTabIds.length === 0) {
      setScratchDraftContent(nextValue);
    }
  }

  function updateActiveDocumentPostTitle(nextValue: string) {
    if (!activeTabId) return;
    const nextTitleFileName = defaultSaveFileName(nextValue.trim() || "Untitled");
    setOpenDocuments((prev) => {
      const current = prev[activeTabId];
      if (!current) return prev;
      return {
        ...prev,
        [activeTabId]: {
          ...current,
          postTitle: nextValue,
          // Keep tab / header / Save As filename aligned with the in-document Title.
          title: nextTitleFileName,
        },
      };
    });
    if (saveAsModalOpen) {
      setSaveAsLiveFileName(nextTitleFileName);
    }
  }

  function updateActiveDocumentSubtitle(nextValue: string) {
    if (!activeTabId) return;
    setOpenDocuments((prev) => {
      const current = prev[activeTabId];
      if (!current) return prev;
      return { ...prev, [activeTabId]: { ...current, subtitle: nextValue } };
    });
  }

  function updateActiveDocumentNotes(nextValue: string) {
    if (!activeTabId) return;
    setOpenDocuments((prev) => {
      const current = prev[activeTabId];
      if (!current) return prev;
      return { ...prev, [activeTabId]: { ...current, notes: nextValue } };
    });
  }

  function updateActiveDocumentCriteria(nextValue: string) {
    if (!activeTabId) return;
    setOpenDocuments((prev) => {
      const current = prev[activeTabId];
      if (!current) return prev;
      return { ...prev, [activeTabId]: { ...current, criteria: nextValue } };
    });
  }

  const handleAddCollectPreviewToNotes = useCallback(
    (preview: string) => {
      const currentNotes = activeDocument?.notes ?? "";
      updateActiveDocumentNotes(appendTextToDocumentNotes(currentNotes, preview));
    },
    [activeDocument?.notes, activeTabId],
  );

  function runToolbarCommand(command: EditorCommand) {
    if (mode !== "edit" || !tiptapEditor) return;
    runEditorFormat(tiptapEditor, command);
  }

  /** Selection floating menu: works whenever the editor is editable. */
  function runEditorFormatCommand(command: EditorCommand, opts?: LinkFormatOptions) {
    if (!tiptapEditor || !editorEditable) return;
    runEditorFormat(tiptapEditor, command, opts);
  }

  const finalizeSavedPath = useCallback(
    (outPath: string, markdown: string) => {
      const savedNotes = activeDocument?.notes ?? "";
      const savedCriteria = activeDocument?.criteria ?? "";
      const savedSubtitle = activeDocument?.subtitle ?? "";
      // Align in-document Title with the saved file basename.
      const syncedPostTitle =
        splitFileBaseAndExtension(fileNameFromPath(outPath)).base || "Untitled";
      if (activeTabId && activeDocument) {
        const oldId = activeTabId;
        if (oldId !== outPath) {
          const nextDoc: WorkspaceDocument = {
            ...activeDocument,
            id: outPath,
            title: fileNameFromPath(outPath),
            sourcePath: outPath,
            content: markdown,
            lastSavedContent: markdown,
            postTitle: syncedPostTitle,
            lastSavedPostTitle: syncedPostTitle,
            lastSavedSubtitle: savedSubtitle,
            lastSavedNotes: savedNotes,
            lastSavedCriteria: savedCriteria,
          };
          setOpenDocuments((prev) => {
            const { [oldId]: _removed, ...rest } = prev;
            return { ...rest, [outPath]: nextDoc };
          });
          setOpenTabIds((ids) => ids.map((id) => (id === oldId ? outPath : id)));
          setActiveTabId(outPath);
          setSelectedPath(outPath);
          return;
        }
        setOpenDocuments((prev) => ({
          ...prev,
          [outPath]: {
            ...prev[outPath]!,
            content: markdown,
            lastSavedContent: markdown,
            postTitle: syncedPostTitle,
            lastSavedPostTitle: syncedPostTitle,
            lastSavedSubtitle: savedSubtitle,
            lastSavedNotes: savedNotes,
            lastSavedCriteria: savedCriteria,
          },
        }));
        setSelectedPath(outPath);
        return;
      }

      const doc: WorkspaceDocument = {
        id: outPath,
        title: fileNameFromPath(outPath),
        content: markdown,
        sourcePath: outPath,
        kind: "text",
        lastSavedContent: markdown,
        postTitle: syncedPostTitle,
        lastSavedPostTitle: syncedPostTitle,
        subtitle: savedSubtitle,
        lastSavedSubtitle: savedSubtitle,
        notes: savedNotes,
        lastSavedNotes: savedNotes,
        criteria: savedCriteria,
        lastSavedCriteria: savedCriteria,
      };
      setOpenDocuments((prev) => ({ ...prev, [outPath]: doc }));
      setOpenTabIds([outPath]);
      setActiveTabId(outPath);
      setSelectedPath(outPath);
      setScratchDraftContent("");
      setScratchDiskPath(null);
      setScratchLastSavedContent("");
      setScratchDocumentTitle("Untitled");
    },
    [activeDocument, activeTabId],
  );

  const openSaveAsModal = useCallback(
    (opts?: { purpose?: "document" | "podcast-notes" }) => {
      if (!isTauriRuntime()) {
        window.alert("Save As is only available in the Harvy desktop app.");
        return;
      }
      if (!hasWorkspaceFolder) {
        window.alert("Choose a workspace folder before saving files.");
        return;
      }
      if (!editorEditable) return;
      const purpose = opts?.purpose ?? "document";
      if (purpose === "podcast-notes") {
        if (!aiCheckConfig?.enabled || !aiCheckConfig.hasApiKey) {
          window.alert("Enable AI check and add an API key in Settings → Sidebars first.");
          return;
        }
      }
      const titleFromFile =
        activeDocument?.title ?? (openTabIds.length === 0 ? scratchDocumentTitle : "Untitled");
      const titleBase =
        activeDocument?.postTitle.trim() ||
        splitFileBaseAndExtension(titleFromFile).base ||
        "Untitled";
      const suggestedFileName = defaultSaveFileName(titleBase);
      editorFocusBeforeSaveAsRef.current = editorFocusSuppressedRef.current;
      visuallyDeactivateEditor(tiptapEditor);
      setEditorInactive(true);
      setSaveAsPurpose(purpose);
      setSaveAsInitialFileName(suggestedFileName);
      setSaveAsLiveFileName(suggestedFileName);
      setSaveAsDestinationPath(workspaceBrowsePath ?? supportedTree?.path ?? null);
      setSaveAsModalOpen(true);
    },
    [
      editorEditable,
      activeDocument,
      openTabIds.length,
      scratchDocumentTitle,
      workspaceBrowsePath,
      supportedTree?.path,
      hasWorkspaceFolder,
      tiptapEditor,
      setEditorInactive,
      aiCheckConfig?.enabled,
      aiCheckConfig?.hasApiKey,
    ],
  );

  const finishSaveAsModal = useCallback(() => {
    setSaveAsModalOpen(false);
    setSaveAsLiveFileName("");
    setSaveAsPurpose("document");
    setPodcastNotesRunning(false);
    const wasSuppressedBeforeOpen = editorFocusBeforeSaveAsRef.current;
    editorFocusBeforeSaveAsRef.current = null;
    if (wasSuppressedBeforeOpen === false) {
      setEditorInactive(false);
    }
  }, [setEditorInactive]);

  const handleSaveAsFileNameChange = useCallback((fileName: string) => {
    setSaveAsLiveFileName(fileName);
  }, []);

  const closeSaveAsModal = useCallback(() => {
    if (saveAsSubmitting) return;
    finishSaveAsModal();
  }, [saveAsSubmitting, finishSaveAsModal]);

  const pickSaveAsDestination = useCallback(async () => {
    if (!workspaceRootPath) {
      window.alert("Choose a workspace folder before saving files.");
      return;
    }
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Choose folder",
        defaultPath: saveAsDestinationPath ?? workspaceBrowsePath ?? supportedTree?.path ?? undefined,
      });
      if (typeof selected !== "string") return;
      if (!isPathUnderWorkspaceRoot(workspaceRootPath, selected)) {
        window.alert("Please choose a folder inside your workspace.");
        return;
      }
      setSaveAsDestinationPath(selected);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }, [saveAsDestinationPath, workspaceBrowsePath, supportedTree?.path, workspaceRootPath]);

  const commitSaveAsFromModal = useCallback(
    async ({ fileName, organize }: { fileName: string; organize: SaveAsOrganizeMode }) => {
      const validationError = validateSaveAsOutputPath(saveAsDestinationPath, fileName);
      if (validationError) {
        window.alert(validationError);
        return;
      }
      if (workspaceRootPath && saveAsDestinationPath && !isPathUnderWorkspaceRoot(workspaceRootPath, saveAsDestinationPath)) {
        window.alert("Choose a destination inside your workspace folder.");
        return;
      }

      let markdown = getDocumentMarkdown(tiptapEditor, activeDocument?.content ?? scratchDraftContent);
      const folderContext = getProjectStructure({
        notes: activeDocument?.notes ?? "",
        criteria: activeDocument?.criteria ?? "",
        editor: tiptapEditor,
        documentMarkdown: markdown,
      });
      const organizeMode: SaveAsOrganizeMode =
        saveAsPurpose === "podcast-notes" || folderContext.hasImages ? "folder" : organize;

      const resolved = resolveSaveAsOutputPath(saveAsDestinationPath!, fileName, organizeMode);
      if (!resolved) {
        window.alert("Enter a valid file name.");
        return;
      }

      const { path: outPath, leaf, folderBase } = resolved;
      setSaveAsSubmitting(true);
      if (saveAsPurpose === "podcast-notes") setPodcastNotesRunning(true);
      try {
        let projectDir: string | null = null;
        if (organizeMode === "folder") {
          projectDir = await invoke<string>("ensure_directory", {
            parentPath: saveAsDestinationPath,
            folderName: folderBase,
          });

          for (const relativePath of projectSubfolderPathsToCreate(folderContext)) {
            let parent = projectDir;
            for (const segment of relativePath.split("/")) {
              parent = await invoke<string>("ensure_directory", {
                parentPath: parent,
                folderName: segment,
              });
            }
          }

          if (folderContext.hasImages && workspaceRootPath) {
            const { replacements } = await packageDocumentImages({
              workspaceRoot: workspaceRootPath,
              projectDir,
              sources: collectEmbeddedImageSrcs(tiptapEditor, markdown),
            });
            markdown = applyImageSrcRewrites(tiptapEditor, markdown, replacements);
          }
        }

        const exists = await invoke<boolean>("path_exists", { path: outPath });
        if (exists) {
          const ok = await confirm(`"${leaf}" already exists at this location. Replace it?`, {
            title: "Save As",
            kind: "warning",
          });
          if (!ok) return;
        }

        await invoke("write_text_file", {
          path: outPath,
          contents: markdownForDisk(markdown, activeDocument),
        });
        if (folderContext.hasNotes) {
          await saveDocumentNotes(outPath, activeDocument?.notes ?? "");
        }
        if (folderContext.hasCriteria) {
          await saveDocumentCriteria(outPath, activeDocument?.criteria ?? "");
        }

        if (saveAsPurpose === "podcast-notes") {
          if (!projectDir) {
            throw new Error("Podcast notes require a project folder.");
          }
          const { text } = tiptapEditor
            ? proofreadPlainTextAndPositions(tiptapEditor.state.doc)
            : { text: activeDocument?.content ?? scratchDraftContent };
          const essay = text.trim();
          if (!essay) {
            throw new Error("Nothing to export — the document is empty.");
          }
          const notes = await generatePodcastNotes(essay);
          const exportsDir = await invoke<string>("ensure_directory", {
            parentPath: projectDir,
            folderName: "Exports",
          });
          const pdfPath = normalizePdfSavePath(
            joinPath(exportsDir, defaultPodcastNotesPdfFileName(folderBase)),
          );
          await invoke("export_markdown_pdf", { path: pdfPath, markdown: notes.markdown });
        }

        finalizeSavedPath(outPath, markdown);
        await reloadWorkspaceTree();
        finishSaveAsModal();
      } catch (e) {
        window.alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setSaveAsSubmitting(false);
        setPodcastNotesRunning(false);
      }
    },
    [
      saveAsDestinationPath,
      saveAsPurpose,
      workspaceRootPath,
      tiptapEditor,
      activeDocument,
      scratchDraftContent,
      finalizeSavedPath,
      reloadWorkspaceTree,
      finishSaveAsModal,
    ],
  );

  const saveAsDestinationDisplay = saveAsDestinationPath
    ? fileNameFromPath(saveAsDestinationPath)
    : "Choose folder…";

  const saveAsFolderPreviewContext = useMemo(() => {
    const structure = getProjectStructure({
      notes: activeDocument?.notes ?? "",
      criteria: activeDocument?.criteria ?? "",
      editor: tiptapEditor,
      documentMarkdown: getDocumentMarkdown(
        tiptapEditor,
        activeDocument?.content ?? scratchDraftContent,
      ),
    });
    if (saveAsPurpose !== "podcast-notes") return structure;
    const titleBase =
      documentTitleBaseFromSaveAsFileName(saveAsLiveFileName || saveAsInitialFileName) ||
      "Untitled";
    return {
      ...structure,
      exportFolders: [
        {
          folderName: "Exports",
          files: [defaultPodcastNotesPdfFileName(titleBase)],
        },
      ],
    };
  }, [
    activeDocument?.notes,
    activeDocument?.criteria,
    activeDocument?.content,
    scratchDraftContent,
    tiptapEditor,
    saveAsPurpose,
    saveAsLiveFileName,
    saveAsInitialFileName,
  ]);

  const performExportPdf = useCallback(async () => {
    if (!isTauriRuntime()) {
      window.alert("Export as PDF is only available in the Harvy desktop app.");
      return;
    }
    if (!hasWorkspaceFolder || !workspaceRootPath) {
      window.alert("Choose a workspace folder before exporting files.");
      return;
    }
    if (!editorEditable) return;
    const title =
      activeDocument?.title ??
      (openTabIds.length === 0 ? scratchDocumentTitle : "Untitled");
    const exportFolder = workspaceBrowsePath ?? supportedTree?.path ?? workspaceRootPath;
    let path: string | null;
    try {
      path = await save({
        title: "Export as PDF",
        defaultPath: joinPath(exportFolder, defaultPdfFileName(title)),
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
      return;
    }
    if (!path) return;
    const outPath = normalizePdfSavePath(path);
    if (!isPathUnderWorkspaceRoot(workspaceRootPath, outPath)) {
      window.alert("Please export the PDF inside your workspace folder.");
      return;
    }
    const markdown = getDocumentMarkdown(
      tiptapEditor,
      activeDocument?.content ?? scratchDraftContent,
    );
    try {
      await invoke("export_markdown_pdf", { path: outPath, markdown });
    } catch (e) {
      window.alert(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [
    activeDocument,
    editorEditable,
    hasWorkspaceFolder,
    openTabIds.length,
    scratchDocumentTitle,
    scratchDraftContent,
    supportedTree?.path,
    tiptapEditor,
    workspaceBrowsePath,
    workspaceRootPath,
  ]);

  const performExportPodcastNotesPdf = useCallback(() => {
    if (podcastNotesRunning || saveAsSubmitting) return;
    openSaveAsModal({ purpose: "podcast-notes" });
  }, [openSaveAsModal, podcastNotesRunning, saveAsSubmitting]);

  const performSave = useCallback(async () => {
    if (!isTauriRuntime()) {
      window.alert("Save is only available in the Harvy desktop app.");
      return;
    }
    if (!hasWorkspaceFolder) {
      window.alert("Choose a workspace folder before saving files.");
      return;
    }
    if (!editorEditable) return;
    if (!isDirty) return;

    try {
      if (activeTabId && activeDocument) {
        const path = activeDocument.sourcePath;
        if (!path) {
          openSaveAsModal();
          return;
        }
        let markdown = getDocumentMarkdown(tiptapEditor, activeDocument.content);
        const folderContext = getProjectStructure({
          notes: activeDocument.notes,
          criteria: activeDocument.criteria,
          editor: tiptapEditor,
          documentMarkdown: markdown,
        });

        let outPath = path;
        if (folderContext.hasImages && workspaceRootPath) {
          let projectDir = resolveProjectDirectory(path);
          if (!projectDir) {
            const parent = parentDirectory(path);
            const leaf = fileNameFromPath(path);
            const { base } = splitFileBaseAndExtension(leaf);
            if (!base) {
              window.alert("Could not create a project folder for this document.");
              return;
            }
            projectDir = await invoke<string>("ensure_directory", {
              parentPath: parent,
              folderName: base,
            });
            for (const relativePath of projectSubfolderPathsToCreate(folderContext)) {
              let dirParent = projectDir;
              for (const segment of relativePath.split("/")) {
                dirParent = await invoke<string>("ensure_directory", {
                  parentPath: dirParent,
                  folderName: segment,
                });
              }
            }
            const packagedPath = joinPath(projectDir, leaf);
            if (normalizeFsPath(path) !== normalizeFsPath(packagedPath)) {
              const exists = await invoke<boolean>("path_exists", { path: packagedPath });
              if (exists) {
                const ok = await confirm(
                  `"${leaf}" already exists inside the project folder. Replace it?`,
                  { title: "Save", kind: "warning" },
                );
                if (!ok) return;
              } else {
                await invoke("rename_fs_path", { fromPath: path, toPath: packagedPath });
              }
            }
            outPath = packagedPath;
          }

          const { replacements } = await packageDocumentImages({
            workspaceRoot: workspaceRootPath,
            projectDir,
            sources: collectEmbeddedImageSrcs(tiptapEditor, markdown),
          });
          markdown = applyImageSrcRewrites(tiptapEditor, markdown, replacements);
        }

        await invoke("write_text_file", {
          path: outPath,
          contents: markdownForDisk(markdown, activeDocument),
        });
        await saveDocumentNotes(outPath, activeDocument.notes);
        await saveDocumentCriteria(outPath, activeDocument.criteria);
        if (outPath !== path) {
          finalizeSavedPath(outPath, markdown);
          await reloadWorkspaceTree();
        } else {
          setOpenDocuments((prev) => ({
            ...prev,
            [activeTabId]: {
              ...prev[activeTabId]!,
              content: markdown,
              lastSavedContent: markdown,
              lastSavedPostTitle: activeDocument.postTitle,
              lastSavedSubtitle: activeDocument.subtitle,
              lastSavedNotes: activeDocument.notes,
              lastSavedCriteria: activeDocument.criteria,
            },
          }));
        }
        return;
      }
      if (openTabIds.length === 0) {
        if (scratchDiskPath) {
          let markdown = getDocumentMarkdown(tiptapEditor, scratchDraftContent);
          const folderContext = getProjectStructure({
            notes: "",
            criteria: "",
            editor: tiptapEditor,
            documentMarkdown: markdown,
          });
          let outPath = scratchDiskPath;
          if (folderContext.hasImages && workspaceRootPath) {
            let projectDir = resolveProjectDirectory(scratchDiskPath);
            if (!projectDir) {
              openSaveAsModal();
              return;
            }
            const { replacements } = await packageDocumentImages({
              workspaceRoot: workspaceRootPath,
              projectDir,
              sources: collectEmbeddedImageSrcs(tiptapEditor, markdown),
            });
            markdown = applyImageSrcRewrites(tiptapEditor, markdown, replacements);
            outPath = scratchDiskPath;
          }
          await invoke("write_text_file", {
            path: outPath,
            contents: markdownForDisk(markdown, null),
          });
          setScratchLastSavedContent(markdown);
          setScratchDraftContent(markdown);
        } else {
          openSaveAsModal();
        }
      }
    } catch (e) {
      window.alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [
    activeDocument,
    activeTabId,
    isDirty,
    openTabIds.length,
    openSaveAsModal,
    editorEditable,
    hasWorkspaceFolder,
    tiptapEditor,
    scratchDiskPath,
    scratchDraftContent,
    workspaceRootPath,
    finalizeSavedPath,
    reloadWorkspaceTree,
  ]);

  /** Keep sidebar selection aligned with the open tab’s file; virtual tabs use browse/root, not the synthetic id. */
  useEffect(() => {
    if (activeTabId && !isVirtualDocumentTabId(activeTabId)) {
      setSelectedPath(activeTabId);
      return;
    }
    if (!supportedTree) return;
    const browseAtRoot = !activeTabId && openTabIds.length === 0;
    if (browseAtRoot || (activeTabId && isVirtualDocumentTabId(activeTabId))) {
      setSelectedPath(workspaceBrowsePath ?? supportedTree.path);
    }
  }, [activeTabId, openTabIds.length, workspaceBrowsePath, supportedTree?.path]);

  useEffect(() => {
    setFileMenuHandlers({
      save: () => void performSave(),
      saveAs: () => void openSaveAsModal(),
      exportPdf: () => void performExportPdf(),
      newMarkdownFile: () => void handleCreateMarkdownFileRef.current(),
    });
  }, [performSave, openSaveAsModal, performExportPdf]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void setupNativeAppMenu().catch((err) => console.error("Native app menu:", err));
  }, []);

  useEffect(() => setupWindowDragRegions(), []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
          if (focusModeActiveRef.current) {
            event.preventDefault();
            return;
          }
          if (!isDirtyRef.current) return;
          try {
            const ok = await confirm("Discard unsaved changes and close the window?", {
              title: "Harvy",
              kind: "warning",
            });
            if (!ok) event.preventDefault();
          } catch (err) {
            // Keep the window open if the confirm dialog fails.
            console.error("Close confirmation failed:", err);
            event.preventDefault();
          }
        });
      } catch (err) {
        if (!cancelled) console.error("Failed to listen for window close:", err);
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (isTauriRuntime()) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (isEditableKeyboardTarget(e.target)) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('[role="dialog"]')) return;
      if (el?.closest("[data-floating-text-menu]")) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        if (e.shiftKey) void openSaveAsModal();
        else void performSave();
        return;
      }
      if (k === "e" && e.shiftKey) {
        e.preventDefault();
        void performExportPdf();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [performSave, openSaveAsModal, performExportPdf]);

  function toggleFolder(path: string) {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  /** Remove a tab from the strip; activates a neighbor if the closed tab was active. */
  function closeTab(id: string) {
    const prevIds = openTabIdsRef.current;
    if (!prevIds.includes(id)) return;

    const doc = openDocuments[id];
    if (doc && isDocumentDirty(doc)) {
      const ok = window.confirm(`Discard unsaved changes to “${doc.title}”?`);
      if (!ok) return;
    }

    const nextIds = prevIds.filter((tabId) => tabId !== id);
    const nextActive = nextActiveTabIdAfterClose(prevIds, id, activeTabIdRef.current);

    setOpenTabIds(nextIds);
    setActiveTabId(nextActive);
    if (nextIds.length === 0) {
      setScratchDraftContent("");
      setScratchDiskPath(null);
      setScratchLastSavedContent("");
      setScratchDocumentTitle("Untitled");
    }
    setOpenDocuments((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }

  async function selectNode(node: FileNode) {
    if (node.kind === "directory") {
      setSelectedPath(node.path);
      return;
    }

    if (!hasWorkspaceFolder) {
      window.alert("Choose a workspace folder before opening files.");
      return;
    }

    // Images open in a modal — don't switch editor tabs or prompt about dirty state.
    if (isImagePreviewable(node.path)) {
      setSelectedPath(node.path);
      setImagePreview({ fileName: node.name, sourcePath: node.path });
      return;
    }

    if (isDirty && node.path !== activeTabId) {
      const ok = window.confirm("Discard unsaved changes and open this file?");
      if (!ok) return;
    }

    setSelectedPath(node.path);

    setScratchDraftContent("");
    setScratchDiskPath(null);
    setScratchLastSavedContent("");

    const id = node.path;
    if (openDocuments[id]) {
      setActiveTabId(id);
      setOpenTabIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      return;
    }

    const previewable = isTextPreviewable(node.path);
    let content = "Preview not available yet for this file type.";
    let kind: WorkspaceDocument["kind"] = "placeholder";

    if (previewable) {
      try {
        const raw = await invoke<string>("read_workspace_text_file", { path: node.path });
        const { meta, body: rawBody } = parseDocumentFrontmatter(raw);
        content = ingestTextFileContent(rawBody, node.path);
        kind = "text";
        const [notes, criteria] = await Promise.all([
          loadDocumentNotes(node.path),
          loadDocumentCriteria(node.path),
        ]);
        const nextDoc: WorkspaceDocument = {
          id,
          title: node.name,
          content,
          sourcePath: node.path,
          kind,
          lastSavedContent: content,
          postTitle: meta.postTitle,
          lastSavedPostTitle: meta.postTitle,
          subtitle: meta.subtitle,
          lastSavedSubtitle: meta.subtitle,
          notes,
          lastSavedNotes: notes,
          criteria,
          lastSavedCriteria: criteria,
        };
        setOpenDocuments((prev) => ({ ...prev, [id]: nextDoc }));
        setActiveTabId(id);
        setOpenTabIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
        return;
      } catch (error) {
        content =
          "Could not read this file.\n\n" +
          (error instanceof Error ? error.message : String(error));
        kind = "placeholder";
      }
    }

    const notes = "";
    const criteria = "";

    const nextDoc: WorkspaceDocument = {
      id,
      title: node.name,
      content,
      sourcePath: node.path,
      kind,
      lastSavedContent: content,
      postTitle: "",
      lastSavedPostTitle: "",
      subtitle: "",
      lastSavedSubtitle: "",
      notes,
      lastSavedNotes: notes,
      criteria,
      lastSavedCriteria: criteria,
    };

    setOpenDocuments((prev) => ({ ...prev, [id]: nextDoc }));
    setActiveTabId(id);
    setOpenTabIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  async function handleCreateMarkdownFile() {
    if (!isTauriRuntime()) {
      window.alert("Creating files on disk requires the Harvy desktop app.");
      return;
    }
    if (!hasWorkspaceFolder || !supportedTree || !workspaceRootPath) {
      window.alert("Choose a workspace folder before creating files.");
      return;
    }
    const folder = workspaceBrowsePath ?? supportedTree.path;
    const sep = folder.includes("\\") ? "\\" : "/";
    const trimmed = folder.replace(/[/\\]+$/, "");
    const defaultPath = `${trimmed}${sep}Untitled.md`;
    let path: string | null;
    try {
      path = await save({
        title: "New Markdown file",
        defaultPath,
        filters: [{ name: "Markdown", extensions: ["md", "markdown", "mkd"] }],
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
      return;
    }
    if (!path) return;
    const outPath = normalizeMarkdownSavePath(path);
    if (!isPathUnderWorkspaceRoot(workspaceRootPath, outPath)) {
      window.alert("Please save the file inside your workspace folder.");
      return;
    }
    const seed = "# \n\n";
    try {
      await invoke("write_text_file", { path: outPath, contents: seed });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
      return;
    }
    await reloadWorkspaceTree();
    await selectNode({
      name: fileNameFromPath(outPath),
      path: outPath,
      kind: "file",
    });
  }
  handleCreateMarkdownFileRef.current = handleCreateMarkdownFile;

  async function handleStartWritingFromIdea(item: CollectItem) {
    if (!isTauriRuntime()) {
      window.alert("Starting a draft requires the Harvy desktop app.");
      return;
    }
    if (!hasWorkspaceFolder || !supportedTree || !workspaceRootPath) {
      window.alert("Choose a workspace folder before starting a draft.");
      return;
    }

    const folder = workspaceBrowsePath ?? supportedTree.path;
    const title = item.preview.trim() || "Untitled";
    const notes = (item.body ?? "").trim();
    const seed = notes ? `# ${title}\n\n${notes}\n` : `# ${title}\n\n`;
    const base =
      title
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "untitled";

    let outPath = normalizeMarkdownSavePath(joinPath(folder, `${base}.md`));
    let suffix = 2;
    while (await invoke<boolean>("path_exists", { path: outPath })) {
      outPath = normalizeMarkdownSavePath(joinPath(folder, `${base}-${suffix}.md`));
      suffix += 1;
    }

    try {
      await invoke("write_text_file", { path: outPath, contents: seed });
      if (item.notionPageId) {
        try {
          await markNotionIdeaStarted(item.notionPageId);
        } catch (e) {
          window.alert(
            `Draft created, but Notion Status wasn’t updated: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }
      setCollectItems((prev) => prev.filter((row) => row.id !== item.id));
      await reloadWorkspaceTree();
      setActiveWorkspaceSection("write");
      await selectNode({
        name: fileNameFromPath(outPath),
        path: outPath,
        kind: "file",
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }

  const updateFolderRenameDraft = useCallback((draft: string) => {
    setFolderRename((prev) => {
      if (!prev) return prev;
      const next = { ...prev, draft };
      folderRenameRef.current = next;
      return next;
    });
  }, []);

  const cancelFolderRename = useCallback(() => {
    skipFolderRenameCommitRef.current = true;
    folderRenameRef.current = null;
    setFolderRename(null);
  }, []);

  const commitFolderRename = useCallback(async () => {
    if (skipFolderRenameCommitRef.current) {
      skipFolderRenameCommitRef.current = false;
      return;
    }
    const fr = folderRenameRef.current;
    if (!fr) return;
    const next = fr.draft.trim();
    const err = validateFolderName(next);
    if (err) {
      window.alert(err);
      return;
    }
    if (next === fr.originalBasename) {
      folderRenameRef.current = null;
      setFolderRename(null);
      return;
    }
    const parent = parentDirectory(fr.path);
    const targetPath = joinPath(parent, next);
    try {
      await invoke("rename_fs_path", { fromPath: fr.path, toPath: targetPath });
      await reloadWorkspaceTree();
      setSelectedPath(targetPath);
      setExpandedPaths((prev) => new Set([...prev, parent]));
      folderRenameRef.current = null;
      setFolderRename(null);
    } catch (e) {
      console.error(e);
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }, [reloadWorkspaceTree]);

  async function handleCreateFolder() {
    if (!isTauriRuntime()) {
      window.alert("Creating folders requires the Harvy desktop app.");
      return;
    }
    if (!hasWorkspaceFolder || !supportedTree) {
      window.alert("Choose a workspace folder before creating folders.");
      return;
    }
    skipFolderRenameCommitRef.current = false;
    const parent = resolveParentForNewFolder(supportedTree, selectedPath, workspaceBrowsePath);
    try {
      const newPath = await invoke<string>("create_unique_directory", {
        parentPath: parent,
        baseName: "New Folder",
      });
      await reloadWorkspaceTree();
      const bn = fileNameFromPath(newPath);
      setExpandedPaths((prev) => new Set([...prev, parent]));
      setSelectedPath(newPath);
      const st = { path: newPath, draft: bn, originalBasename: bn };
      folderRenameRef.current = st;
      setFolderRename(st);
    } catch (e) {
      console.error(e);
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }

  const editorTitle =
    activeDocument?.title ??
    (openTabIds.length === 0 ? scratchDocumentTitle : "Untitled");
  const editorTitleBase = saveAsModalOpen
    ? documentTitleBaseFromSaveAsFileName(saveAsLiveFileName)
    : splitFileBaseAndExtension(editorTitle).base || "Untitled";

  /** Inline rename draft so Notes pop-out can follow typing before commit. */
  const [titleRenameDraft, setTitleRenameDraft] = useState<string | null>(null);
  const notesDocumentTitle =
    titleRenameDraft !== null
      ? titleRenameDraft.trim() || "Untitled"
      : editorTitleBase.trim() || "Untitled";

  useEffect(() => {
    setTitleRenameDraft(null);
  }, [activeTabId]);

  const activeNotes = activeDocument?.notes ?? "";
  const activeCriteria = activeDocument?.criteria ?? "";
  const notesPopoutSyncRef = useRef({
    notes: "",
    documentTitle: "Untitled",
    applyNotes: (_value: string) => {},
  });
  notesPopoutSyncRef.current = {
    notes: activeNotes,
    documentTitle: notesDocumentTitle,
    applyNotes: updateActiveDocumentNotes,
  };

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void emitNotesPopoutState({
      notes: activeNotes,
      documentTitle: notesDocumentTitle,
    });
  }, [activeNotes, notesDocumentTitle, activeTabId]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlistenUpdate: (() => void) | undefined;
    let unlistenRequest: (() => void) | undefined;
    void (async () => {
      try {
        unlistenUpdate = await listenNotesPopoutUpdate((payload) => {
          notesPopoutSyncRef.current.applyNotes(payload.notes);
        });
        unlistenRequest = await listenNotesPopoutRequest(() => {
          const snap = notesPopoutSyncRef.current;
          void emitNotesPopoutState({
            notes: snap.notes,
            documentTitle: snap.documentTitle,
          });
        });
      } catch (err) {
        console.error("Notes pop-out listeners failed:", err);
      }
    })();
    return () => {
      unlistenUpdate?.();
      unlistenRequest?.();
    };
  }, []);

  useEffect(() => {
    savePersistedCollectItems(collectItems);
  }, [collectItems]);

  /** Inline rename for an open file tab, or for the scratch buffer when no tabs are open. */
  const titleRenameEnabled =
    (Boolean(activeTabId && activeDocument) || openTabIds.length === 0) && !saveAsModalOpen;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[HarvyTitle] shell", {
      titleRenameEnabled,
      activeTabId,
      hasActiveDocument: Boolean(activeDocument),
      openTabCount: openTabIds.length,
      editorTitleBase,
    });
  }, [titleRenameEnabled, activeTabId, activeDocument, openTabIds.length, editorTitleBase]);
  const editorText =
    activeDocument?.content ??
    (openTabIds.length === 0
      ? scratchDraftContent
      : hasWorkspaceFolder
        ? "Select a tab above or pick a file from your workspace."
        : "Choose a workspace folder to open and save files.");
  const showReadabilityHighlights = readabilityPanelOpen && mode === "edit";
  const showMechanicsUnderlines = readabilityPanelOpen && mode === "edit";
  /** Native misspelling underlines: same gate as grammar highlights (Edit tab + readability rail open + user pref). */
  const showEditModeSpellcheck =
    writingAssistancePrefs.spellcheck && readabilityPanelOpen && mode === "edit";

  useEffect(() => {
    writingAssistanceViewRef.showReadabilityHighlights = showReadabilityHighlights;
    if (!tiptapEditor) return;
    const tr = tiptapEditor.state.tr.setMeta(grammarDecorationsKey, true);
    tiptapEditor.view.dispatch(tr);
  }, [showReadabilityHighlights, tiptapEditor, parametersPrefs.fkComplexityThreshold]);

  useEffect(() => {
    if (!tiptapEditor) return;
    setMechanicsUnderlinesVisible(tiptapEditor.view, showMechanicsUnderlines);
  }, [showMechanicsUnderlines, tiptapEditor]);

  useEffect(() => {
    void ensureHunspellLoaded();
  }, []);

  useEffect(() => {
    aiProofreadIssuesRef.current = aiProofreadIssues;
  }, [aiProofreadIssues]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const refresh = () => {
      void getAiCheckConfig()
        .then((next) => {
          setAiCheckConfig(next);
          syncAiCheckPopoverPrefs(next);
        })
        .catch(() => {
          setAiCheckConfig(null);
          syncAiCheckPopoverPrefs(null);
        });
    };
    refresh();
    window.addEventListener("harvy:ai-check-config-changed", refresh);
    return () => window.removeEventListener("harvy:ai-check-config-changed", refresh);
  }, []);

  /** TipTap Placeholder extension only renders when the doc is empty; no real document text. */
  const editorPlaceholder = editorEditable ? sessionEditorPrompt : undefined;
  const editorInstanceKey = activeTabId ?? (openTabIds.length === 0 ? "scratch" : "browse");

  useEffect(() => {
    aiProofreadIssuesRef.current = [];
    setAiProofreadIssues([]);
    setAiCheckCostLabel(null);
    setAiCheckError(null);
  }, [editorInstanceKey]);

  const persistAiIssues = useCallback((issues: ProofreadIssue[]) => {
    const prev = aiProofreadIssuesRef.current;
    const unchanged =
      prev.length === issues.length &&
      prev.every(
        (issue, index) =>
          issue.start === issues[index]!.start &&
          issue.end === issues[index]!.end &&
          issue.text === issues[index]!.text &&
          issue.message === issues[index]!.message,
      );
    if (unchanged) return;
    aiProofreadIssuesRef.current = issues;
    setAiProofreadIssues(issues);
  }, []);

  /** Live rule-based mechanics (Spelling / Grammar / Suggestions) — runs in Edit mode regardless of sidebar. */
  useEffect(() => {
    if (!tiptapEditor || mode !== "edit" || !editorEditable) {
      return;
    }

    const runSync = () => {
      void syncMechanicsProofread(
        tiptapEditor,
        setProofreadIssues,
        () => aiProofreadIssuesRef.current,
        persistAiIssues,
      );
    };

    runSync();

    let debounceId: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = () => {
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(runSync, 200);
    };

    tiptapEditor.on("update", onUpdate);
    return () => {
      tiptapEditor.off("update", onUpdate);
      if (debounceId) clearTimeout(debounceId);
    };
  }, [tiptapEditor, mode, editorEditable, persistAiIssues]);

  const refreshMechanicsProofread = useCallback(() => {
    if (!tiptapEditor) return;
    void syncMechanicsProofread(
      tiptapEditor,
      setProofreadIssues,
      () => aiProofreadIssuesRef.current,
      persistAiIssues,
    );
  }, [tiptapEditor, persistAiIssues]);

  const handleRunAiCheck = useCallback(async () => {
    if (!tiptapEditor || !isTauriRuntime()) return;
    setMode("edit");
    setAiCheckRunning(true);
    setAiCheckError(null);
    try {
      const { text } = proofreadPlainTextAndPositions(tiptapEditor.state.doc);
      const result = await runAiCheck(text);
      const located = locateAiIssuesInText(text, result.issues);
      persistAiIssues(located);
      const usd = estimateCostUsd({
        modelId: result.model,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
      });
      // Fall back to essay-length estimate if the API omitted usage.
      const costUsd =
        (result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0) > 0
          ? usd
          : estimateAiCheckCostFromEssay(result.model, text);
      setAiCheckCostLabel(formatAiCheckCostUsd(costUsd));
      await syncMechanicsProofread(
        tiptapEditor,
        setProofreadIssues,
        () => located,
        persistAiIssues,
      );
    } catch (e) {
      setAiCheckError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiCheckRunning(false);
    }
  }, [tiptapEditor, persistAiIssues]);

  useEffect(() => {
    setSpellingDocumentKey(editorInstanceKey);
  }, [editorInstanceKey]);

  useEffect(() => {
    syncSpellingContextMenuRef({
      enabled: showMechanicsUnderlines && editorEditable,
      issues: proofreadIssues,
      documentKey: editorInstanceKey,
      onRefresh: refreshMechanicsProofread,
    });
  }, [
    showMechanicsUnderlines,
    editorEditable,
    proofreadIssues,
    editorInstanceKey,
    refreshMechanicsProofread,
  ]);

  const copyDocumentFallbackMarkdown = useMemo(
    () => activeDocument?.content ?? (openTabIds.length === 0 ? scratchDraftContent : ""),
    [activeDocument?.content, openTabIds.length, scratchDraftContent],
  );

  const handleCopyDocument = useCallback(async () => {
    return copyDocumentToClipboard(tiptapEditor, copyDocumentFallbackMarkdown, workspaceRootPath);
  }, [tiptapEditor, copyDocumentFallbackMarkdown, workspaceRootPath]);

  const handlePublishDocument = useCallback(async () => {
    const destination = normalizeQuickLinkUrl(publishUrl);
    if (!destination) return;
    // Open on the click itself so the system browser is not blocked by clipboard work.
    openSafeExternalUrl(destination);
    try {
      await copyDocumentToClipboard(tiptapEditor, copyDocumentFallbackMarkdown, workspaceRootPath);
    } catch {
      // The destination is already opening; paste if the copy succeeds in the background.
    }
  }, [publishUrl, tiptapEditor, copyDocumentFallbackMarkdown, workspaceRootPath]);

  const handlePrintDocument = useCallback(() => {
    printDocumentFromEditor(tiptapEditor, copyDocumentFallbackMarkdown, editorTitleBase);
  }, [tiptapEditor, copyDocumentFallbackMarkdown, editorTitleBase]);

  const handleInsertImage = useCallback(() => {
    if (!tiptapEditor || !editorEditable) return;
    insertHarvyImagePlaceholderAtCursor(tiptapEditor);
  }, [tiptapEditor, editorEditable]);

  const pickLocalImage = useCallback(async () => {
    if (!hasWorkspaceFolder && isTauriRuntime()) {
      window.alert("Choose a workspace folder before uploading images.");
      return null;
    }
    return pickAndImportWorkspaceImage();
  }, [hasWorkspaceFolder]);

  const loadImageAtPos = useCallback(
    (pos: number, attrs: HarvyImageLoadAttrs) => {
      if (!tiptapEditor || !editorEditable || !attrs.src) return;
      loadHarvyImageAt(tiptapEditor, pos, attrs);
    },
    [tiptapEditor, editorEditable],
  );

  const commitActiveDocumentTitleRename = useCallback(
    async (rawBase: string): Promise<boolean> => {
      if (openTabIds.length === 0) {
        const displayLabel = scratchDocumentTitle.trim() || "Untitled";
        const { base: displayBase, extWithDot } = splitFileBaseAndExtension(displayLabel);
        let nextBase = sanitizeFileBasename(rawBase);
        if (!nextBase) nextBase = "Untitled";
        if (nextBase === displayBase) return true;
        const nameErr = validateFolderName(nextBase);
        if (nameErr) {
          window.alert(nameErr);
          return false;
        }
        const newTitle = extWithDot ? `${nextBase}${extWithDot}` : nextBase;
        setScratchDocumentTitle(newTitle);
        return true;
      }

      const id = activeTabId;
      const doc = id ? openDocuments[id] : null;
      if (!id || !doc) return false;

      const pathBasename = doc.sourcePath.trim()
        ? fileNameFromPath(doc.sourcePath)
        : "";
      const displayLabel = doc.title.trim() ? doc.title : pathBasename || "Untitled";
      const { base: displayBase } = splitFileBaseAndExtension(displayLabel);

      let nextBase = sanitizeFileBasename(rawBase);
      if (!nextBase) nextBase = "Untitled";
      if (nextBase === displayBase) {
        // File/tab name already matches; still keep in-document Title aligned.
        if (doc.postTitle !== nextBase) {
          setOpenDocuments((prev) => {
            const d = prev[id];
            if (!d) return prev;
            return { ...prev, [id]: { ...d, postTitle: nextBase } };
          });
        }
        return true;
      }

      const nameErr = validateFolderName(nextBase);
      if (nameErr) {
        window.alert(nameErr);
        return false;
      }

      const canRenameOnDisk = isTauriRuntime() && Boolean(doc.sourcePath.trim());

      if (!canRenameOnDisk) {
        const { extWithDot: displayExt } = splitFileBaseAndExtension(displayLabel);
        const newTitle = displayExt ? `${nextBase}${displayExt}` : nextBase;
        setOpenDocuments((prev) => {
          const d = prev[id];
          if (!d || (d.title === newTitle && d.postTitle === nextBase)) return prev;
          return { ...prev, [id]: { ...d, title: newTitle, postTitle: nextBase } };
        });
        return true;
      }

      const { extWithDot } = splitFileBaseAndExtension(pathBasename || displayLabel);
      const newFileName = extWithDot ? `${nextBase}${extWithDot}` : nextBase;
      const sourcePath = doc.sourcePath;
      const parent = parentDirectory(sourcePath);
      const targetPath = joinPath(parent, newFileName);
      if (targetPath === sourcePath) return true;

      try {
        await invoke("rename_fs_path", { fromPath: sourcePath, toPath: targetPath });
        await renameDocumentNotesSidecar(sourcePath, targetPath);
        await renameDocumentCriteriaSidecar(sourcePath, targetPath);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
        return false;
      }

      setOpenDocuments((prev) => {
        const d = prev[id];
        if (!d) return prev;
        const nextDoc: WorkspaceDocument = {
          ...d,
          id: targetPath,
          sourcePath: targetPath,
          title: fileNameFromPath(targetPath),
          postTitle: nextBase,
        };
        const { [id]: _removed, ...rest } = prev;
        return { ...rest, [targetPath]: nextDoc };
      });
      setOpenTabIds((prev) => prev.map((tabId) => (tabId === id ? targetPath : tabId)));
      setActiveTabId((cur) => (cur === id ? targetPath : cur));
      setSelectedPath((p) => (p === id ? targetPath : p));
      if (scratchDiskPath === id) setScratchDiskPath(targetPath);
      await reloadWorkspaceTree();
      return true;
    },
    [
      activeTabId,
      openDocuments,
      openTabIds.length,
      reloadWorkspaceTree,
      scratchDiskPath,
      scratchDocumentTitle,
    ],
  );

  const workspaceSidebarPanel = (
    <SidebarLeft
      workspaceSelected={hasWorkspaceFolder}
      onChooseFolder={chooseWorkspaceFolder}
      workspaceRoots={workspaceListRoots}
      workspaceHasData={Boolean(supportedTree)}
      breadcrumbVolumeLabel={breadcrumbVolumeFirst}
      breadcrumbRootDisplayLabel={breadcrumbRootDisplayLabel}
      breadcrumbFolderSegments={breadcrumbFolderSegments}
      isLoading={isLoadingTree}
      loadError={workspaceError}
      selectedPath={selectedPath}
      expandedPaths={expandedPaths}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      onToggleFolder={toggleFolder}
      onSelectNode={selectNode}
      onOpenFolder={openWorkspaceFolder}
      onBreadcrumbNavigate={navigateBreadcrumbDisplayIndex}
      onWorkspaceNavigateUp={closeWorkspaceOneLevel}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onOpenAbout={() => setIsAboutOpen(true)}
      onCreateFolder={handleCreateFolder}
      folderRenamePath={folderRename?.path ?? null}
      folderRenameDraft={folderRename?.draft ?? ""}
      onFolderRenameDraftChange={updateFolderRenameDraft}
      onFolderRenameCommit={() => void commitFolderRename()}
      onFolderRenameCancel={cancelFolderRename}
    />
  );

  const aiCheckModelDisplay = aiCheckConfig?.model
    ? formatAiModelDisplayName(aiCheckConfig.model, aiCheckConfig.provider)
    : null;

  const aiCheckCostDisplay = useMemo(() => {
    if (aiCheckCostLabel) return aiCheckCostLabel;
    if (!aiCheckConfig?.enabled || !aiCheckConfig.model) return null;
    const essay =
      tiptapEditor != null
        ? proofreadPlainTextAndPositions(tiptapEditor.state.doc).text
        : editorText;
    if (!essay.trim()) return null;
    return formatAiCheckCostUsd(estimateAiCheckCostFromEssay(aiCheckConfig.model, essay));
  }, [aiCheckCostLabel, aiCheckConfig?.enabled, aiCheckConfig?.model, tiptapEditor, editorText]);

  const readabilitySidebarPanel = (
    <SidebarRight
      stats={stats}
      mode={mode}
      onModeChange={setMode}
      selectedWordCount={selectedWordCount}
      notes={activeNotes}
      onNotesChange={updateActiveDocumentNotes}
      criteria={activeCriteria}
      onCriteriaChange={updateActiveDocumentCriteria}
      onToggleNotesPopout={() => {
        void toggleNotesPopoutWindow().catch((err) => {
          console.error("Notes pop-out failed:", err);
          window.alert(err instanceof Error ? err.message : String(err));
        });
      }}
      proofreadIssues={proofreadIssues}
      workspaceSection={activeWorkspaceSection}
      showQuickLinks={showQuickLinks}
      showCriteria={showCriteria}
      aiCheckEnabled={Boolean(
        aiCheckConfig?.enabled && aiCheckConfig.hasApiKey && showAiCheck,
      )}
      aiCheckModelLabel={aiCheckModelDisplay}
      aiCheckRunning={aiCheckRunning}
      aiCheckCostLabel={aiCheckCostDisplay}
      aiCheckError={aiCheckError}
      onRunAiCheck={handleRunAiCheck}
    />
  );

  const tabBarRow = (
    <div
      className={`harvy-title-bar-drag h-8 overflow-hidden transition-[background-color,border-color,box-shadow] duration-500 ease-in-out ${
        hideTopBarWhileTyping ? "border-transparent bg-stage shadow-none" : "bg-mist"
      }`}
      data-harvy-window-drag
    >
      <div
        className={`transition-[opacity,transform] duration-500 ease-in-out ${
          hideTopBarWhileTyping ? "pointer-events-none -translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <OpenWindowsBar
          tabs={openTabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTab}
          onCloseTab={closeTab}
          onCreateTab={createUntitledTab}
          chromeHidden={hideTopBarWhileTyping}
          workspaceSidebarOpen={isWorkspaceSidebarOpen}
          overlayWorkspaceRail={sidebarOverlayLayout}
          isWindowFullscreen={isWindowFullscreen}
        />
      </div>
    </div>
  );

  const documentHeaderRow = (
    <div
      className={`h-[2.125rem] overflow-hidden transition-[background-color,border-color,box-shadow] duration-500 ease-in-out ${
        hideTopBarWhileTyping && hideDocumentTitleWhileTyping
          ? "border-transparent bg-stage shadow-none"
          : "bg-mist/25"
      }`}
    >
      <EditorDocumentHeader
        documentTitleBase={editorTitleBase}
        documentDirty={isDirty}
        workspaceSidebarOpen={isWorkspaceSidebarOpen}
        overlayWorkspaceRail={sidebarOverlayLayout}
        isWindowFullscreen={isWindowFullscreen}
        readabilityPanelOpen={readabilityPanelOpen}
        titleHidden={hideDocumentTitleWhileTyping}
        titleRenameEnabled={titleRenameEnabled}
        onCommitDocumentTitle={commitActiveDocumentTitleRename}
        onTitleDraftChange={setTitleRenameDraft}
      />
    </div>
  );

  const collectUsesFullWidth = activeWorkspaceSection === "collect";
  /**
   * Collect/Outliers uses full width — inset so content clears floating rails and the
   * Collect/Write section switcher. Applied on the Collect wrapper (not the shared
   * Write/Collect section) so opening Collect doesn’t animate padding from 0 and
   * slide under an already-open left sidebar.
   */
  const collectInsetStyle = {
    paddingLeft:
      (sidebarOverlayLayout && isWorkspaceSidebarOpen ? WORKSPACE_SIDEBAR_WIDTH_PX : 0) +
      (showWorkspaceNavigation ? WORKSPACE_SECTION_SWITCHER_WIDTH_PX : 0),
    paddingRight:
      sidebarOverlayLayout && readabilityPanelOpen ? TOOLS_SIDEBAR_WIDTH_PX : 0,
  };
  /** Write column: clear the Collect/Write rail so title/body aren’t flush against it. */
  const writeInsetStyle = showWorkspaceNavigation
    ? { paddingLeft: WORKSPACE_SECTION_SWITCHER_WIDTH_PX }
    : undefined;

  const editorPanelSection = (
    <div className="flex min-h-0 w-full flex-1 justify-center overflow-hidden bg-stage">
      <section
        className={`flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-stage ${
          collectUsesFullWidth ? "max-w-none" : "mx-auto max-w-[820px]"
        }`}
        aria-label={collectUsesFullWidth ? "Research" : "Editor"}
        role="tabpanel"
        id="harvy-editor-panel"
        aria-labelledby={activeTabId ? `harvy-tab-${activeTabId}` : undefined}
      >
        {activeWorkspaceSection === "collect" ? (
          <div
            className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${
              collectPaddingAnimated ? "transition-[padding] duration-500 ease-in-out" : ""
            }`}
            style={collectInsetStyle}
          >
            <CollectPanel
              items={collectItems}
              onItemsChange={setCollectItems}
              onAddPreviewToNotes={handleAddCollectPreviewToNotes}
              onStartWriting={handleStartWritingFromIdea}
              showOutliersView={showOutliersView}
              showCollectView={showCollectView}
              showAvatarView={showAvatarView}
              workspaceSidebarOpen={isWorkspaceSidebarOpen}
              toolsSidebarOpen={readabilityPanelOpen}
            />
          </div>
        ) : null}
        <div
          className={
            activeWorkspaceSection === "write"
              ? "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              : "hidden"
          }
          style={activeWorkspaceSection === "write" ? writeInsetStyle : undefined}
          aria-hidden={activeWorkspaceSection !== "write"}
        >
          {SHOW_FORMATTING_TOOLBAR ? <EditorToolbar mode={mode} onRunCommand={runToolbarCommand} /> : null}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <EditorCanvas
              key={editorInstanceKey}
              mode={mode}
              documentTitle={editorTitle}
              text={editorText}
              contentSourcePath={activeDocument?.sourcePath ?? null}
              postTitle={
                saveAsModalOpen
                  ? editorTitleBase
                  : titleRenameDraft !== null
                    ? titleRenameDraft
                    : (activeDocument?.postTitle ?? "")
              }
              subtitle={activeDocument?.subtitle ?? ""}
              showPostTitle={documentHeaderPrefs.showTitle && !focusModeActive}
              showSubtitle={documentHeaderPrefs.showSubtitle && !focusModeActive}
              onChangePostTitle={updateActiveDocumentPostTitle}
              onChangeSubtitle={updateActiveDocumentSubtitle}
              placeholder={editorPlaceholder}
              isEditable={editorEditable}
              spellcheckEnabled={showEditModeSpellcheck}
              grammarChecksEnabled={
                writingAssistancePrefs.grammarChecks && readabilityPanelOpen && mode === "edit"
              }
              showReadabilityHighlights={showReadabilityHighlights}
              showMechanicsUnderlines={showMechanicsUnderlines}
              blockBackspace={focusModeActive}
              focusModeActive={focusModeActive}
              workspaceRootPath={workspaceRootPath}
              pickLocalImage={pickLocalImage}
              loadImageAt={loadImageAtPos}
              onInsertImage={editorEditable ? () => void handleInsertImage() : undefined}
              onChangeText={updateActiveDocumentContent}
              onEditorReady={handleEditorReady}
              onTypingActivity={emitEditorTypingActivity}
              editorVisuallyInactive={editorVisuallyInactive}
              editorFocusSuppressedRef={editorFocusSuppressedRef}
              onEditorUserActivated={handleEditorUserActivated}
            />
            <FloatingTextMenu
              editor={tiptapEditor}
              isEditable={editorEditable}
              onApplyFormat={runEditorFormatCommand}
            />
            <EditorAmbientControls
              activityHandlerRef={editorTypingActivityHandlerRef}
              onToggleBothSidebars={toggleBothSidebars}
              onOpenFocusMode={() => setIsFocusModeOpen(true)}
              focusModeActive={focusModeActive}
              focusRemainingLabel={
                focusModeActive ? formatFocusRemaining(focusRemainingMs) : undefined
              }
              onCopyDocument={handleCopyDocument}
              onPublish={handlePublishDocument}
              publishEnabled={Boolean(normalizeQuickLinkUrl(publishUrl))}
              onPodcastNotesPdf={performExportPodcastNotesPdf}
              onSaveAsPdf={performExportPdf}
              onPrint={handlePrintDocument}
              podcastNotesEnabled={Boolean(aiCheckConfig?.enabled && aiCheckConfig.hasApiKey)}
              podcastNotesRunning={podcastNotesRunning}
              syncWithChrome
              chromeHidden={hideBottomToolsWhileTyping && !focusModeActive}
            />
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div
      className={`relative h-full min-h-0 w-full overflow-hidden bg-canvas${
        focusModeActive ? " harvy-focus-mode-shell" : ""
      }`}
    >
      {sidebarOverlayLayout ? (
        <>
          {/* Wide viewport: rails float over a fixed max-width editor (unchanged). */}
          <div className="absolute inset-0 z-0 flex min-h-0 min-w-0 flex-col bg-canvas">
            {tabBarRow}
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-stage">
              {documentHeaderRow}
              {editorPanelSection}
              {/* Readability: pinned overlay — top clears document header strip */}
              <div
                aria-hidden={!readabilityPanelOpen}
                className={`absolute bottom-0 right-0 top-[2.125rem] z-10 flex flex-col overflow-hidden bg-stage transition-[width] duration-500 ease-in-out [backdrop-filter:none] ${
                  readabilityPanelOpen ? "" : "pointer-events-none"
                }`}
                style={{ width: readabilityPanelOpen ? TOOLS_SIDEBAR_WIDTH_PX : 0 }}
              >
                <div
                  className={`flex h-full min-h-0 shrink-0 flex-col transition-opacity duration-500 ease-in-out ${
                    readabilityPanelOpen ? "opacity-100 delay-0" : "opacity-0 delay-0"
                  }`}
                  style={{ width: TOOLS_SIDEBAR_WIDTH_PX }}
                >
                  {readabilitySidebarPanel}
                </div>
              </div>
            </div>
          </div>
          {showWorkspaceNavigation ? (
            <WorkspaceSectionSwitcher
              activeSection={activeWorkspaceSection}
              onSectionChange={handleWorkspaceSectionChange}
              sections={workspaceSections}
              showOutliersView={showOutliersView}
              showCollectView={showCollectView}
              showAvatarView={showAvatarView}
              chromeHidden={hideWorkspaceSectionRail}
              className="absolute top-[var(--harvy-workspace-section-rail-top)] z-20"
              style={{
                left: isWorkspaceSidebarOpen
                  ? `${WORKSPACE_SIDEBAR_WIDTH_PX}px`
                  : "var(--harvy-workspace-section-rail-left-collapsed)",
              }}
            />
          ) : null}
          <div
            aria-hidden={!isWorkspaceSidebarOpen}
            className={`absolute inset-y-0 left-0 z-10 overflow-hidden bg-stage transition-[width] duration-500 ease-in-out ${
              isWorkspaceSidebarOpen ? "w-[260px]" : "w-0"
            }`}
          >
            <div
              className={`flex h-full min-h-0 w-[260px] flex-col transition-opacity duration-500 ease-in-out ${
                isWorkspaceSidebarOpen ? "opacity-100 delay-0" : "opacity-0 delay-0"
              }`}
            >
              {workspaceSidebarPanel}
            </div>
          </div>
        </>
      ) : (
        /* Narrow viewport: flex rails — editor column shrinks (no overlay). */
        <div className="absolute inset-0 z-0 flex min-h-0 min-w-0 flex-row bg-canvas">
          <div
            aria-hidden={!isWorkspaceSidebarOpen}
            className={`shrink-0 overflow-hidden bg-stage transition-[width] duration-500 ease-in-out ${
              isWorkspaceSidebarOpen ? "w-[260px]" : "pointer-events-none w-0"
            }`}
          >
            <div
              className={`flex h-full min-h-0 w-[260px] flex-col transition-opacity duration-500 ease-in-out ${
                isWorkspaceSidebarOpen ? "opacity-100 delay-0" : "opacity-0 delay-0"
              }`}
            >
              {workspaceSidebarPanel}
            </div>
          </div>
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
            {showWorkspaceNavigation ? (
              <WorkspaceSectionSwitcher
                activeSection={activeWorkspaceSection}
                onSectionChange={handleWorkspaceSectionChange}
                sections={workspaceSections}
                showOutliersView={showOutliersView}
                showCollectView={showCollectView}
                showAvatarView={showAvatarView}
                chromeHidden={hideWorkspaceSectionRail}
                className="absolute top-[var(--harvy-workspace-section-rail-top)] z-20"
                style={{
                  left: isWorkspaceSidebarOpen
                    ? 0
                    : "var(--harvy-workspace-section-rail-left-collapsed)",
                }}
              />
            ) : null}
            {tabBarRow}
            <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden bg-stage">
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {documentHeaderRow}
                {editorPanelSection}
              </div>
              <div
                aria-hidden={!readabilityPanelOpen}
                className={`flex shrink-0 flex-col overflow-hidden bg-stage transition-[width] duration-500 ease-in-out [backdrop-filter:none] ${
                  readabilityPanelOpen ? "" : "pointer-events-none"
                }`}
                style={{ width: readabilityPanelOpen ? TOOLS_SIDEBAR_WIDTH_PX : 0 }}
              >
                <div
                  className={`flex h-full min-h-0 shrink-0 flex-col transition-opacity duration-500 ease-in-out ${
                    readabilityPanelOpen ? "opacity-100 delay-0" : "opacity-0 delay-0"
                  }`}
                  style={{ width: TOOLS_SIDEBAR_WIDTH_PX }}
                >
                  {readabilitySidebarPanel}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`pointer-events-none absolute top-0 z-30 flex h-8 items-center rounded-md px-0.5 transition-[opacity,background-color,left] duration-500 ease-in-out ${
          hideTopBarWhileTyping || focusModeActive ? "bg-stage opacity-0" : "bg-mist/55 opacity-100"
        }`}
        style={{ left: workspaceSidebarToggleLeft }}
      >
        <ChromeSidebarToggleButton
          icon={PanelLeft}
          open={isWorkspaceSidebarOpen}
          onClick={toggleLeftSidebar}
          ariaLabelOpen="Hide sidebar"
          ariaLabelClosed="Show sidebar"
          shortcutHint={formatHotkeyChord(["Option", "ArrowLeft"])}
        />
      </div>

      {focusModeActive ? (
        <p
          className="harvy-focus-mode-hint absolute z-30"
          style={{
            top: isWindowFullscreen ? "0.65rem" : "0.55rem",
            left: workspaceSidebarToggleLeft,
          }}
        >
          press <kbd>[esc]</kbd> to end focus mode
        </p>
      ) : null}

      {/* Right tools-panel toggle — window-shell anchored so Notes / layout changes never shift it. */}
      <div
        className={`pointer-events-none absolute top-8 right-2 z-30 flex h-[2.125rem] items-center transition-opacity duration-500 ease-in-out ${
          hideTopBarWhileTyping || focusModeActive ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="pointer-events-auto shrink-0">
          <ChromeSidebarToggleButton
            icon={PanelRight}
            open={readabilityPanelOpen}
            onClick={toggleRightSidebar}
            ariaLabelOpen="Hide tools panel"
            ariaLabelClosed="Show tools panel"
            shortcutHint={formatHotkeyChord(["Option", "ArrowRight"])}
          />
        </div>
      </div>

      <SettingsModal
        open={isSettingsOpen}
        onClose={closeSettings}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        appearanceStyleId={appearanceStyleId}
        onAppearanceStyleIdChange={setAppearanceStyleId}
        resolvedTheme={resolvedTheme}
        systemPrefersDark={systemPrefersDark}
        showQuickLinks={showQuickLinks}
        onShowQuickLinksChange={handleShowQuickLinksChange}
        showCriteria={showCriteria}
        onShowCriteriaChange={handleShowCriteriaChange}
        showAiCheck={showAiCheck}
        onShowAiCheckChange={handleShowAiCheckChange}
        criteria={activeCriteria}
        onCriteriaChange={updateActiveDocumentCriteria}
        publishUrl={publishUrl}
        onPublishUrlChange={handlePublishUrlChange}
        spellcheckEnabled={writingAssistancePrefs.spellcheck}
        onSpellcheckChange={handleSpellcheckPref}
        focusVisibilityPrefs={focusVisibilityPrefs}
        onFocusVisibilityPrefChange={handleFocusVisibilityPrefChange}
        documentHeaderPrefs={documentHeaderPrefs}
        onDocumentHeaderPrefChange={handleDocumentHeaderPrefChange}
        editorPromptPrefs={editorPromptPrefs}
        onEditorPromptPrefsChange={handleEditorPromptPrefsChange}
        enableCollect={enableCollect}
        onEnableCollectChange={handleEnableCollectChange}
        showOutliersView={showOutliersView}
        showCollectView={showCollectView}
        showAvatarView={showAvatarView}
        onShowOutliersViewChange={handleShowOutliersViewChange}
        onShowCollectViewChange={handleShowCollectViewChange}
        onShowAvatarViewChange={handleShowAvatarViewChange}
        encouragementPrefs={encouragementPrefs}
        onEncouragementPrefsChange={handleEncouragementPrefsChange}
        onTestEncouragement={testEncouragement}
        parametersPrefs={parametersPrefs}
        onParametersPrefsChange={handleParametersPrefsChange}
        workspaceRootPath={workspaceRootPath}
        onChooseWorkspaceFolder={chooseWorkspaceFolder}
      />
      <EncouragementToast phrase={encouragementPhrase} onDismiss={dismissEncouragement} />
      <SaveAsModal
        open={saveAsModalOpen}
        onClose={closeSaveAsModal}
        initialFileName={saveAsInitialFileName}
        initialOrganize={saveAsPurpose === "podcast-notes" ? "folder" : "file"}
        forceFolderOrganize={saveAsPurpose === "podcast-notes"}
        destinationPath={saveAsDestinationPath}
        destinationDisplay={saveAsDestinationDisplay}
        isSubmitting={saveAsSubmitting}
        onPickDestination={pickSaveAsDestination}
        onSave={(payload) => void commitSaveAsFromModal(payload)}
        onFileNameChange={handleSaveAsFileNameChange}
        folderPreviewContext={saveAsFolderPreviewContext}
      />
      <AboutModal open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
      <FocusModeModal
        open={isFocusModeOpen}
        onClose={() => setIsFocusModeOpen(false)}
        endsAt={focusSessionEndsAt}
        onStart={startFocusMode}
        onEnd={endFocusMode}
        remainingLabel={
          focusSessionEndsAt != null ? formatFocusRemaining(focusRemainingMs) : undefined
        }
      />
      <ImagePreviewModal
        open={imagePreview !== null}
        target={imagePreview}
        workspaceRootPath={workspaceRootPath}
        onClose={() => setImagePreview(null)}
      />
    </div>
  );
}
