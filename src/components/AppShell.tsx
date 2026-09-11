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
import { PdfConvertPreviewModal } from "./PdfConvertPreviewModal";
import { PodcastNotesPreviewModal } from "./PodcastNotesPreviewModal";
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
import {
  getNotionIdeasConfig,
  markNotionEssayPublished,
  markNotionIdeaStarted,
  todayLocalIsoDate,
} from "../features/notion/notionIdeas";
import {
  loadNotionEssayLink,
  mergeNotionEssayLink,
  notionFieldsFromLink,
  notionLinkFromFields,
  renameNotionEssaySidecar,
  saveNotionEssayLink,
  syncEssayWithNotion,
  type NotionEssayLink,
} from "../features/notion/notionEssaySync";
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
import type { CollectSubView } from "../features/workspace/collectViews";
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
import { setViewMenuHandlers } from "../features/menu/viewMenuBridge";
import { setupNativeAppMenu } from "../features/menu/setupNativeAppMenu";
import { setupWindowDragRegions } from "../features/window/setupWindowDragRegions";
import { isDocumentNameKeyboardTarget, isEditableKeyboardTarget } from "../lib/isEditableKeyboardTarget";
import { formatHotkeyChord, matchSidebarToggleHotkey, matchViewHotkey } from "../features/settings/hotkeys";
import {
  emitNotesPopoutState,
  listenNotesPopoutRequest,
  listenNotesPopoutUpdate,
  openNotesPopoutWindow,
  toggleNotesPopoutWindow,
} from "../features/notes/notesPopout";
import { visuallyDeactivateEditor } from "../features/editor/editorCanvasFocus";
import { runEditorFormat, setLinkOnRange, type LinkFormatOptions } from "../features/editor/editorFormatActions";
import { calculateEditorStats } from "../features/editor/stats";
import { pickAndImportWorkspaceImage } from "../features/editor/imageAssets";
import { copyDocumentToClipboard } from "../features/editor/documentClipboard";
import { openSafeExternalUrl } from "../features/editor/openExternalUrl";
import { printDocumentFromEditor, printMarkdownDocument } from "../features/editor/documentPrint";
import { shareAnchorFromElement, shareMarkdownPdf } from "../features/editor/documentShare";
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
import { finderNameToPosixSegment, posixSegmentToFinderName } from "../features/workspace/finderFileNames";
import {
  browsePathFromFolderSegments,
  filterFileTree,
  filterTree,
  findNodeByPath,
  isImagePreviewable,
  isPdfDocument,
  isTextPreviewable,
} from "../features/workspace/tree";
import {
  pdfExtractedRunsToMarkdown,
  siblingMarkdownPathForImport,
  type PdfTextRun,
} from "../features/workspace/pdfImport";
import { isPathUnderWorkspaceRoot, normalizeFsPath } from "../features/workspace/workspacePaths";
import {
  isExactOpenDocument,
  resolveOpenDocumentPath,
  visibleOpenDocumentTrailPath,
} from "../features/workspace/openDocumentTrail";
import {
  documentNotesSidecarPath,
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
import { EMPTY_NOTION_ESSAY_FIELDS, type FileNode, type WorkspaceDocument } from "../features/workspace/types";
import {
  excerptFromMarkdown,
  loadRelatedEssaySidecar,
  RELATED_DRAFT_CHARS,
  renameRelatedEssaySidecar,
  saveRelatedEssaySidecar,
  preferredRelatedUrl,
  type RelatedEssayItem,
} from "../features/related-essays/relatedEssays";
import { syncRelatedEssayLinkingRef } from "../features/related-essays/relatedEssayLinkingRef";
import {
  collectDocLinkHrefs,
  locateRelatedPhrasesInText,
  MAX_RELATED_LINKS,
  relatedIssuesAfterLinking,
  uniqueLinkedRelatedPaths,
  uniqueStrings,
} from "../features/related-essays/relatedPhrases";
import {
  hydrateRelatedEssayUrls,
  PUBLIC_URLS_MATCHED_EVENT,
  resolveRelatedEssayHref,
  type PublishedUrlUpdate,
} from "../features/related-essays/matchPublishedUrls";
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
  resolveRenamedDocumentPath,
  suggestedSaveAsFileName,
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
import { setMechanicsUnderlinesVisible, proofreadDecorationsViewRef } from "../features/proofread/mechanicsUnderlineLayer";
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
  generateHeadlinePairs,
  generateHeadlinePairsFromShots,
  generatePodcastNotes,
  getAiCheckConfig,
  locateAiIssuesInText,
  runAiCheck,
  type AiCheckConfigPublic,
  type HeadlinePair,
} from "../features/aiCheck/aiCheck";
import { ensurePodcastNotesBullets } from "../features/aiCheck/podcastNotesMarkdown";
import { syncAiCheckPopoverPrefs } from "../features/aiCheck/aiCheckPopoverPrefs";
import { readHeadlineStylePrompt } from "../features/aiCheck/headlinePromptSettings";
import { loadHeadlineShotsForVision } from "../features/headlines/headlineScreenshotAssets";
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
    ...EMPTY_NOTION_ESSAY_FIELDS,
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
    ...EMPTY_NOTION_ESSAY_FIELDS,
  };
}

function isDocumentDirty(doc: WorkspaceDocument): boolean {
  const titleBase = splitFileBaseAndExtension(doc.title.trim() || "Untitled").base || "Untitled";
  const diskBase = doc.sourcePath.trim()
    ? splitFileBaseAndExtension(fileNameFromPath(doc.sourcePath)).base || ""
    : null;
  const fileNameChanged = diskBase != null && diskBase !== titleBase;

  return (
    doc.content !== doc.lastSavedContent ||
    doc.notes !== doc.lastSavedNotes ||
    doc.criteria !== doc.lastSavedCriteria ||
    doc.postTitle !== doc.lastSavedPostTitle ||
    doc.subtitle !== doc.lastSavedSubtitle ||
    fileNameChanged
  );
}

function markdownForDisk(
  body: string,
  doc: Partial<
    Pick<
      WorkspaceDocument,
      | "postTitle"
      | "subtitle"
      | "notionParentPageId"
      | "notionEssayPageId"
      | "notionRenameParent"
      | "notionParentUrl"
      | "notionEssayUrl"
      | "publicUrl"
    >
  > | null | undefined,
): string {
  return serializeDocumentWithFrontmatter(body, {
    postTitle: doc?.postTitle ?? "",
    subtitle: doc?.subtitle ?? "",
    notionParentPageId: doc?.notionParentPageId ?? "",
    notionEssayPageId: doc?.notionEssayPageId ?? "",
    notionRenameParent: Boolean(doc?.notionRenameParent),
    notionParentUrl: doc?.notionParentUrl ?? "",
    notionEssayUrl: doc?.notionEssayUrl ?? "",
    publicUrl: doc?.publicUrl ?? "",
  });
}

type TitleRenameResult = {
  ok: boolean;
  id?: string;
  title?: string;
  sourcePath?: string;
  postTitle?: string;
};

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
  const [showHeadlinesView, setShowHeadlinesView] = useState(
    () => readWorkspaceSettings().showHeadlinesView,
  );
  const [collectViewOrder, setCollectViewOrder] = useState<CollectSubView[]>(
    () => readWorkspaceSettings().collectViewOrder,
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
  const [notionConnected, setNotionConnected] = useState(false);
  const [notionSyncRunning, setNotionSyncRunning] = useState(false);
  const [notionEssayLink, setNotionEssayLink] = useState<NotionEssayLink | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false);
  const [focusSessionEndsAt, setFocusSessionEndsAt] = useState<number | null>(null);
  const [focusRemainingMs, setFocusRemainingMs] = useState(0);
  const [imagePreview, setImagePreview] = useState<ImagePreviewTarget | null>(null);
  const [pdfConvertPreview, setPdfConvertPreview] = useState<{
    sourcePath: string;
    sourceName: string;
    outPath: string;
    markdown: string | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  const [pdfConvertSubmitting, setPdfConvertSubmitting] = useState(false);
  const pdfConvertGenerationRef = useRef(0);
  const [saveAsModalOpen, setSaveAsModalOpen] = useState(false);
  const [saveAsLiveFileName, setSaveAsLiveFileName] = useState("");
  const [saveAsInitialFileName, setSaveAsInitialFileName] = useState("Untitled.md");
  const [saveAsDestinationPath, setSaveAsDestinationPath] = useState<string | null>(null);
  const [saveAsSubmitting, setSaveAsSubmitting] = useState(false);
  /** Regular document Save As vs podcast-notes export (forces Folder + writes PDF to Exports). */
  const [saveAsPurpose, setSaveAsPurpose] = useState<"document" | "podcast-notes">("document");
  const [podcastNotesPreviewOpen, setPodcastNotesPreviewOpen] = useState(false);
  const [podcastNotesMarkdown, setPodcastNotesMarkdown] = useState<string | null>(null);
  const [podcastNotesPreviewError, setPodcastNotesPreviewError] = useState<string | null>(null);
  const podcastNotesGenerationRef = useRef(0);
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
  const [showPodcastNotes, setShowPodcastNotes] = useState(
    () => readAiCheckSidebarSettings().showPodcastNotes,
  );
  const [showTitleGeneration, setShowTitleGeneration] = useState(
    () => readAiCheckSidebarSettings().showTitleGeneration,
  );
  const [showRelatedEssays, setShowRelatedEssays] = useState(
    () => readAiCheckSidebarSettings().showRelatedEssays,
  );
  /** In-memory buffer when no tabs open — not a saved file until persistence exists. */
  const [scratchDraftContent, setScratchDraftContent] = useState("");
  /** When set, scratch buffer last wrote to this path. */
  const [scratchDiskPath, setScratchDiskPath] = useState<string | null>(null);
  /** Scratch Markdown last successfully written to `scratchDiskPath` (or "" before first save). */
  const [scratchLastSavedContent, setScratchLastSavedContent] = useState("");
  /** Display name for the scratch buffer (no tab row); shown in the document header. */
  const [scratchDocumentTitle, setScratchDocumentTitle] = useState("Untitled");
  /** Inline rename draft so Notes pop-out can follow typing before commit. */
  const [titleRenameDraft, setTitleRenameDraft] = useState<string | null>(null);
  const applyTitleRenameRef = useRef<
    (rawBase: string) => Promise<TitleRenameResult>
  >(async () => ({ ok: false }));
  const titleRenameDraftRef = useRef<string | null>(null);
  titleRenameDraftRef.current = titleRenameDraft;
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
  const [relatedProofreadIssues, setRelatedProofreadIssues] = useState<ProofreadIssue[]>([]);
  const [aiCheckRunning, setAiCheckRunning] = useState(false);
  const [podcastNotesRunning, setPodcastNotesRunning] = useState(false);
  const exportOverlayOpen = saveAsModalOpen || podcastNotesPreviewOpen;
  const [aiCheckCostLabel, setAiCheckCostLabel] = useState<string | null>(null);
  const [aiCheckError, setAiCheckError] = useState<string | null>(null);
  const [headlinePairs, setHeadlinePairs] = useState<HeadlinePair[]>([]);
  const [headlinePairsRunning, setHeadlinePairsRunning] = useState(false);
  const [headlinePairsFromShots, setHeadlinePairsFromShots] = useState(false);
  const [headlinePairsError, setHeadlinePairsError] = useState<string | null>(null);
  const [selectedHeadlineIndex, setSelectedHeadlineIndex] = useState<number | null>(null);
  const aiProofreadIssuesRef = useRef<ProofreadIssue[]>([]);
  const relatedProofreadIssuesRef = useRef<ProofreadIssue[]>([]);
  const relatedLinkedPathsRef = useRef<string[]>([]);
  const relatedItemsRef = useRef<RelatedEssayItem[]>([]);
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
  const printDocumentRef = useRef<() => void>(() => {});

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
    showHeadlinesView: boolean;
    showAvatarView: boolean;
  }) => {
    setShowOutliersView(next.showOutliersView);
    setShowCollectView(next.showCollectView);
    setShowHeadlinesView(next.showHeadlinesView);
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

  const handleShowHeadlinesViewChange = useCallback(
    (enabled: boolean) => {
      applyCollectViewVisibility(writeWorkspaceSettings({ showHeadlinesView: enabled }));
    },
    [applyCollectViewVisibility],
  );

  const handleCollectViewOrderChange = useCallback((order: CollectSubView[]) => {
    const next = writeWorkspaceSettings({ collectViewOrder: order });
    setCollectViewOrder(next.collectViewOrder);
  }, []);

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

  const handleShowPodcastNotesChange = useCallback((enabled: boolean) => {
    const next = writeAiCheckSidebarSettings({ showPodcastNotes: enabled });
    setShowPodcastNotes(next.showPodcastNotes);
  }, []);

  const handleShowTitleGenerationChange = useCallback((enabled: boolean) => {
    const next = writeAiCheckSidebarSettings({ showTitleGeneration: enabled });
    setShowTitleGeneration(next.showTitleGeneration);
  }, []);

  const handleShowRelatedEssaysChange = useCallback((enabled: boolean) => {
    const next = writeAiCheckSidebarSettings({ showRelatedEssays: enabled });
    setShowRelatedEssays(next.showRelatedEssays);
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
    if (exportOverlayOpen) return;

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
  }, [activeWorkspaceSection, tiptapEditor, exportOverlayOpen]);

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
  const openDocumentsRef = useRef(openDocuments);
  const scratchDocumentTitleRef = useRef(scratchDocumentTitle);
  const scratchDiskPathRef = useRef(scratchDiskPath);
  const handleCreateMarkdownFileRef = useRef<() => Promise<void>>(async () => {});
  const notionEssayLinkRef = useRef<NotionEssayLink | null>(null);
  const lastNotionSyncedRef = useRef("");
  const notionSyncedPathRef = useRef<string | null>(null);
  const notionSyncRunningRef = useRef(false);
  openTabIdsRef.current = openTabIds;
  activeTabIdRef.current = activeTabId;
  openDocumentsRef.current = openDocuments;
  scratchDocumentTitleRef.current = scratchDocumentTitle;
  scratchDiskPathRef.current = scratchDiskPath;

  const currentTitleRenameSnapshot = useCallback((): TitleRenameResult => {
    const id = activeTabIdRef.current;
    if (id) {
      const doc = openDocumentsRef.current[id];
      if (doc) {
        return {
          ok: true,
          id: doc.id,
          title: doc.title,
          sourcePath: doc.sourcePath,
          postTitle: doc.postTitle,
        };
      }
    }
    const title = scratchDocumentTitleRef.current;
    return {
      ok: true,
      id: "",
      title,
      sourcePath: scratchDiskPathRef.current ?? "",
      postTitle: splitFileBaseAndExtension(title).base || "Untitled",
    };
  }, []);

  const flushPendingTitleRename = useCallback(async (): Promise<TitleRenameResult> => {
    const draft = titleRenameDraftRef.current;
    if (draft === null) return currentTitleRenameSnapshot();
    const result = await applyTitleRenameRef.current(draft);
    if (result.ok) {
      setTitleRenameDraft(null);
      titleRenameDraftRef.current = null;
    }
    return result;
  }, [currentTitleRenameSnapshot]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = matchViewHotkey(event);
      if (!action) return;
      const el = event.target as HTMLElement | null;
      if (el?.closest('[role="dialog"]')) return;
      if (el?.closest("[data-floating-text-menu]")) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === "notes") {
        void openNotesPopoutWindow().catch((err) => {
          console.error("Notes pop-out failed:", err);
          window.alert(err instanceof Error ? err.message : String(err));
        });
        return;
      }
      if (action === "write") {
        handleWorkspaceSectionChange("write");
        return;
      }
      if (enableCollect) handleWorkspaceSectionChange("collect");
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enableCollect, handleWorkspaceSectionChange]);

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
        if (isFocusModeOpen || isSettingsOpen || isAboutOpen || exportOverlayOpen) return;
        event.preventDefault();
        endFocusMode();
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      // Soft-block in-app quit/hide/minimize shortcuts (OS Cmd+Tab still works).
      if (key === "q" || key === "h" || key === "m") {
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
    exportOverlayOpen,
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

  const openDocumentPath = useMemo(
    () =>
      resolveOpenDocumentPath({
        sourcePath: activeDocument?.sourcePath,
        tabId: activeTabId,
        scratchDiskPath,
        isVirtualTabId: isVirtualDocumentTabId,
      }),
    [activeDocument?.sourcePath, activeTabId, scratchDiskPath],
  );

  const openDocumentTrailPath = useMemo(
    () =>
      visibleOpenDocumentTrailPath(
        workspaceListRoots,
        expandedPaths,
        openDocumentPath,
        workspaceRootPath,
      ),
    [workspaceListRoots, expandedPaths, openDocumentPath, workspaceRootPath],
  );

  const isDirty = useMemo(() => {
    const editorTitleBase = splitFileBaseAndExtension(
      activeDocument?.title ?? (openTabIds.length === 0 ? scratchDocumentTitle : "Untitled"),
    ).base || "Untitled";
    const pendingRename =
      titleRenameDraft !== null && titleRenameDraft.trim() !== editorTitleBase;

    if (activeTabId && activeDocument) {
      return pendingRename || isDocumentDirty(activeDocument);
    }
    if (openTabIds.length === 0) {
      const scratchSavedBase = scratchDiskPath
        ? splitFileBaseAndExtension(fileNameFromPath(scratchDiskPath)).base || "Untitled"
        : "Untitled";
      const scratchRenamed = editorTitleBase !== scratchSavedBase;
      return (
        pendingRename ||
        scratchRenamed ||
        scratchDraftContent !== scratchLastSavedContent
      );
    }
    return pendingRename;
  }, [
    activeTabId,
    activeDocument,
    openTabIds.length,
    scratchDraftContent,
    scratchLastSavedContent,
    scratchDocumentTitle,
    scratchDiskPath,
    titleRenameDraft,
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
        ...EMPTY_NOTION_ESSAY_FIELDS,
        ...notionFieldsFromLink(notionLinkFromFields(activeDocument ?? {})),
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
    async (opts?: { purpose?: "document" | "podcast-notes"; fileName?: string }) => {
      if (!isTauriRuntime()) {
        window.alert("Save As is only available in the Harvy desktop app.");
        return false;
      }
      if (!hasWorkspaceFolder) {
        window.alert("Choose a workspace folder before saving files.");
        return false;
      }
      if (!editorEditable) return false;
      const purpose = opts?.purpose ?? "document";
      if (purpose === "podcast-notes") {
        if (!aiCheckConfig?.enabled || !aiCheckConfig.hasApiKey) {
          window.alert("Enable AI check and add an API key in Settings → Artificial Intelligence first.");
          return false;
        }
        if (!showPodcastNotes) {
          window.alert("Turn on Podcast Notes in Settings → Artificial Intelligence.");
          return false;
        }
      }
      const flushed = await flushPendingTitleRename();
      if (!flushed.ok) return false;
      const suggestedFileName =
        opts?.fileName ??
        suggestedSaveAsFileName({
          fileTitle: flushed.title,
          postTitle: flushed.postTitle,
        });
      if (editorFocusBeforeSaveAsRef.current === null) {
        editorFocusBeforeSaveAsRef.current = editorFocusSuppressedRef.current;
      }
      visuallyDeactivateEditor(tiptapEditor);
      setEditorInactive(true);
      setSaveAsPurpose(purpose);
      setSaveAsInitialFileName(suggestedFileName);
      setSaveAsLiveFileName(suggestedFileName);
      setSaveAsDestinationPath(workspaceBrowsePath ?? supportedTree?.path ?? null);
      setSaveAsModalOpen(true);
      return true;
    },
    [
      editorEditable,
      workspaceBrowsePath,
      supportedTree?.path,
      hasWorkspaceFolder,
      tiptapEditor,
      setEditorInactive,
      aiCheckConfig?.enabled,
      aiCheckConfig?.hasApiKey,
      showPodcastNotes,
      flushPendingTitleRename,
    ],
  );

  const finishSaveAsModal = useCallback(
    (opts?: { restoreEditor?: boolean }) => {
      setSaveAsModalOpen(false);
      setSaveAsLiveFileName("");
      setSaveAsPurpose("document");
      setPodcastNotesRunning(false);
      if (opts?.restoreEditor === false) return;
      const wasSuppressedBeforeOpen = editorFocusBeforeSaveAsRef.current;
      editorFocusBeforeSaveAsRef.current = null;
      if (wasSuppressedBeforeOpen === false) {
        setEditorInactive(false);
      }
    },
    [setEditorInactive],
  );

  const handleSaveAsFileNameChange = useCallback((fileName: string) => {
    setSaveAsLiveFileName(fileName);
  }, []);

  const closeSaveAsModal = useCallback(() => {
    if (saveAsSubmitting) return;
    const returnToPodcastPreview =
      saveAsPurpose === "podcast-notes" && Boolean(podcastNotesMarkdown?.trim());
    finishSaveAsModal({ restoreEditor: !returnToPodcastPreview });
    if (returnToPodcastPreview) {
      setPodcastNotesPreviewOpen(true);
    }
  }, [saveAsSubmitting, finishSaveAsModal, saveAsPurpose, podcastNotesMarkdown]);

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

        const titleForDisk = documentTitleBaseFromSaveAsFileName(fileName);
        const notionFields = {
          ...EMPTY_NOTION_ESSAY_FIELDS,
          ...notionFieldsFromLink(
            notionLinkFromFields(activeDocument ?? {}) ?? notionEssayLinkRef.current,
          ),
        };
        await invoke("write_text_file", {
          path: outPath,
          contents: markdownForDisk(markdown, {
            postTitle: titleForDisk,
            subtitle: activeDocument?.subtitle ?? "",
            ...notionFields,
          }),
        });
        if (notionLinkFromFields(notionFields)) {
          await saveNotionEssayLink(outPath, notionLinkFromFields(notionFields)!);
        }
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
          let notesMarkdown = ensurePodcastNotesBullets(podcastNotesMarkdown?.trim() ?? "");
          if (!notesMarkdown) {
            const { text } = tiptapEditor
              ? proofreadPlainTextAndPositions(tiptapEditor.state.doc)
              : { text: activeDocument?.content ?? scratchDraftContent };
            const essay = text.trim();
            if (!essay) {
              throw new Error("Nothing to export — the document is empty.");
            }
            notesMarkdown = (await generatePodcastNotes(essay)).markdown;
          }
          const exportsDir = await invoke<string>("ensure_directory", {
            parentPath: projectDir,
            folderName: "Exports",
          });
          const pdfPath = normalizePdfSavePath(
            joinPath(exportsDir, defaultPodcastNotesPdfFileName(folderBase)),
          );
          await invoke("export_markdown_pdf", { path: pdfPath, markdown: notesMarkdown });
          setPodcastNotesPreviewOpen(false);
          setPodcastNotesMarkdown(null);
          setPodcastNotesPreviewError(null);
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
      podcastNotesMarkdown,
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

  const closePodcastNotesPreview = useCallback(() => {
    podcastNotesGenerationRef.current += 1;
    setPodcastNotesPreviewOpen(false);
    setPodcastNotesMarkdown(null);
    setPodcastNotesPreviewError(null);
    setPodcastNotesRunning(false);
    const wasSuppressedBeforeOpen = editorFocusBeforeSaveAsRef.current;
    editorFocusBeforeSaveAsRef.current = null;
    if (wasSuppressedBeforeOpen === false) {
      setEditorInactive(false);
    }
  }, [setEditorInactive]);

  const runPodcastNotesGeneration = useCallback(async (essay: string) => {
    const generationId = ++podcastNotesGenerationRef.current;
    setPodcastNotesMarkdown(null);
    setPodcastNotesPreviewError(null);
    setPodcastNotesRunning(true);
    try {
      const notes = await generatePodcastNotes(essay);
      if (podcastNotesGenerationRef.current !== generationId) return;
      setPodcastNotesMarkdown(notes.markdown);
    } catch (e) {
      if (podcastNotesGenerationRef.current !== generationId) return;
      setPodcastNotesPreviewError(e instanceof Error ? e.message : String(e));
    } finally {
      if (podcastNotesGenerationRef.current === generationId) {
        setPodcastNotesRunning(false);
      }
    }
  }, []);

  const performExportPodcastNotesPdf = useCallback(async () => {
    if (podcastNotesRunning || saveAsSubmitting || podcastNotesPreviewOpen) return;
    if (!isTauriRuntime()) {
      window.alert("Export Podcast Notes is only available in the Harvy desktop app.");
      return;
    }
    if (!hasWorkspaceFolder) {
      window.alert("Choose a workspace folder before saving files.");
      return;
    }
    if (!editorEditable) return;
    if (!aiCheckConfig?.enabled || !aiCheckConfig.hasApiKey) {
      window.alert("Enable AI check and add an API key in Settings → Artificial Intelligence first.");
      return;
    }
    if (!showPodcastNotes) {
      window.alert("Turn on Podcast Notes in Settings → Artificial Intelligence.");
      return;
    }
    const { text } = tiptapEditor
      ? proofreadPlainTextAndPositions(tiptapEditor.state.doc)
      : { text: activeDocument?.content ?? scratchDraftContent };
    const essay = text.trim();
    if (!essay) {
      window.alert("Nothing to export — the document is empty.");
      return;
    }

    if (editorFocusBeforeSaveAsRef.current === null) {
      editorFocusBeforeSaveAsRef.current = editorFocusSuppressedRef.current;
    }
    visuallyDeactivateEditor(tiptapEditor);
    setEditorInactive(true);
    setPodcastNotesPreviewOpen(true);
    await runPodcastNotesGeneration(essay);
  }, [
    podcastNotesRunning,
    saveAsSubmitting,
    podcastNotesPreviewOpen,
    hasWorkspaceFolder,
    editorEditable,
    aiCheckConfig?.enabled,
    aiCheckConfig?.hasApiKey,
    showPodcastNotes,
    tiptapEditor,
    activeDocument,
    scratchDraftContent,
    setEditorInactive,
    runPodcastNotesGeneration,
  ]);

  const retryPodcastNotesPreview = useCallback(() => {
    if (podcastNotesRunning || saveAsSubmitting) return;
    const { text } = tiptapEditor
      ? proofreadPlainTextAndPositions(tiptapEditor.state.doc)
      : { text: activeDocument?.content ?? scratchDraftContent };
    const essay = text.trim();
    if (!essay) {
      setPodcastNotesPreviewError("Nothing to export — the document is empty.");
      return;
    }
    void runPodcastNotesGeneration(essay);
  }, [
    podcastNotesRunning,
    saveAsSubmitting,
    tiptapEditor,
    activeDocument,
    scratchDraftContent,
    runPodcastNotesGeneration,
  ]);

  const confirmPodcastNotesExport = useCallback(async () => {
    if (!podcastNotesMarkdown?.trim() || podcastNotesRunning || saveAsSubmitting) return;
    setPodcastNotesPreviewOpen(false);
    const opened = await openSaveAsModal({ purpose: "podcast-notes" });
    if (!opened) {
      setPodcastNotesPreviewOpen(true);
    }
  }, [podcastNotesMarkdown, podcastNotesRunning, saveAsSubmitting, openSaveAsModal]);

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

    const draft = titleRenameDraftRef.current;
    const before = currentTitleRenameSnapshot();
    const currentTitleBase =
      splitFileBaseAndExtension(before.title ?? "Untitled").base || "Untitled";
    const hasPendingRename = draft !== null && draft.trim() !== currentTitleBase;
    if (!isDirty && !hasPendingRename) return;

    const flushed = await flushPendingTitleRename();
    if (!flushed.ok) return;

    const liveDoc =
      activeTabId && activeDocument
        ? {
            ...activeDocument,
            id: flushed.id || activeDocument.id,
            title: flushed.title ?? activeDocument.title,
            sourcePath: flushed.sourcePath ?? activeDocument.sourcePath,
            postTitle: flushed.postTitle ?? activeDocument.postTitle,
          }
        : null;
    const docId = liveDoc?.id || activeTabId;

    try {
      if (docId && liveDoc) {
        const originalPath = liveDoc.sourcePath;
        if (!originalPath) {
          await openSaveAsModal({
            fileName: suggestedSaveAsFileName({
              fileTitle: flushed.title,
              postTitle: flushed.postTitle,
            }),
          });
          return;
        }
        let path = originalPath;
        const renamedPath = resolveRenamedDocumentPath(
          path,
          liveDoc.title || liveDoc.postTitle,
        );
        if (renamedPath) {
          const exists = await invoke<boolean>("path_exists", { path: renamedPath });
          if (exists) {
            window.alert(
              `"${fileNameFromPath(renamedPath)}" already exists at this location.`,
            );
            return;
          }
          await invoke("rename_fs_path", { fromPath: path, toPath: renamedPath });
          await renameDocumentNotesSidecar(path, renamedPath);
          await renameDocumentCriteriaSidecar(path, renamedPath);
          await renameNotionEssaySidecar(path, renamedPath);
          await renameRelatedEssaySidecar(path, renamedPath);
          path = renamedPath;
        }
        let markdown = getDocumentMarkdown(tiptapEditor, liveDoc.content);
        const folderContext = getProjectStructure({
          notes: liveDoc.notes,
          criteria: liveDoc.criteria,
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
                await renameNotionEssaySidecar(path, packagedPath);
                await renameRelatedEssaySidecar(path, packagedPath);
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
          contents: markdownForDisk(markdown, liveDoc),
        });
        await saveDocumentNotes(outPath, liveDoc.notes);
        await saveDocumentCriteria(outPath, liveDoc.criteria);
        if (outPath !== originalPath) {
          finalizeSavedPath(outPath, markdown);
          await reloadWorkspaceTree();
        } else {
          setOpenDocuments((prev) => {
            const current = prev[docId] ?? prev[activeTabId!];
            if (!current) return prev;
            return {
              ...prev,
              [current.id]: {
                ...current,
                content: markdown,
                lastSavedContent: markdown,
                lastSavedPostTitle: liveDoc.postTitle,
                lastSavedSubtitle: liveDoc.subtitle,
                lastSavedNotes: liveDoc.notes,
                lastSavedCriteria: liveDoc.criteria,
              },
            };
          });
        }
        return;
      }
      if (openTabIds.length === 0) {
        const originalDiskPath = flushed.sourcePath || scratchDiskPath;
        if (originalDiskPath) {
          let diskPath = originalDiskPath;
          const renamedScratchPath = resolveRenamedDocumentPath(
            diskPath,
            flushed.title ?? scratchDocumentTitleRef.current,
          );
          if (renamedScratchPath) {
            const exists = await invoke<boolean>("path_exists", { path: renamedScratchPath });
            if (exists) {
              window.alert(
                `"${fileNameFromPath(renamedScratchPath)}" already exists at this location.`,
              );
              return;
            }
            await invoke("rename_fs_path", { fromPath: diskPath, toPath: renamedScratchPath });
            await renameNotionEssaySidecar(diskPath, renamedScratchPath);
            await renameRelatedEssaySidecar(diskPath, renamedScratchPath);
            diskPath = renamedScratchPath;
            scratchDiskPathRef.current = renamedScratchPath;
            setScratchDiskPath(renamedScratchPath);
          }
          let markdown = getDocumentMarkdown(tiptapEditor, scratchDraftContent);
          const folderContext = getProjectStructure({
            notes: "",
            criteria: "",
            editor: tiptapEditor,
            documentMarkdown: markdown,
          });
          let outPath = diskPath;
          if (folderContext.hasImages && workspaceRootPath) {
            let projectDir = resolveProjectDirectory(diskPath);
            if (!projectDir) {
              await openSaveAsModal();
              return;
            }
            const { replacements } = await packageDocumentImages({
              workspaceRoot: workspaceRootPath,
              projectDir,
              sources: collectEmbeddedImageSrcs(tiptapEditor, markdown),
            });
            markdown = applyImageSrcRewrites(tiptapEditor, markdown, replacements);
            outPath = diskPath;
          }
          await invoke("write_text_file", {
            path: outPath,
            contents: markdownForDisk(markdown, {
              postTitle: flushed.postTitle ?? currentTitleBase,
              subtitle: "",
            }),
          });
          setScratchLastSavedContent(markdown);
          setScratchDraftContent(markdown);
          if (outPath !== originalDiskPath) {
            await reloadWorkspaceTree();
          }
        } else {
          await openSaveAsModal({
            fileName: suggestedSaveAsFileName({
              fileTitle: flushed.title,
              postTitle: flushed.postTitle,
            }),
          });
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
    flushPendingTitleRename,
    currentTitleRenameSnapshot,
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
      print: () => printDocumentRef.current(),
      newMarkdownFile: () => void handleCreateMarkdownFileRef.current(),
    });
  }, [performSave, openSaveAsModal, performExportPdf]);

  useEffect(() => {
    setViewMenuHandlers({
      openNotes: () =>
        openNotesPopoutWindow().catch((err) => {
          console.error("Notes pop-out failed:", err);
          window.alert(err instanceof Error ? err.message : String(err));
        }),
      openWrite: () => handleWorkspaceSectionChange("write"),
      openResearch: () => {
        if (enableCollect) handleWorkspaceSectionChange("collect");
      },
    });
  }, [enableCollect, handleWorkspaceSectionChange]);

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
      if (isEditableKeyboardTarget(e.target) && !isDocumentNameKeyboardTarget(e.target)) return;
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

  function closePdfConvertPreview() {
    pdfConvertGenerationRef.current += 1;
    setPdfConvertPreview(null);
    setPdfConvertSubmitting(false);
  }

  async function convertPdfToMarkdown(node: FileNode) {
    if (!isTauriRuntime()) {
      window.alert("Converting PDFs requires the Harvy desktop app.");
      return;
    }

    const generationId = ++pdfConvertGenerationRef.current;
    const outPath = siblingMarkdownPathForImport(node.path);
    setPdfConvertSubmitting(false);
    setPdfConvertPreview({
      sourcePath: node.path,
      sourceName: node.name,
      outPath,
      markdown: null,
      loading: true,
      error: null,
    });

    try {
      const extracted = await invoke<PdfTextRun[]>("extract_pdf_text", { path: node.path });
      if (pdfConvertGenerationRef.current !== generationId) return;
      setPdfConvertPreview({
        sourcePath: node.path,
        sourceName: node.name,
        outPath,
        markdown: pdfExtractedRunsToMarkdown(extracted),
        loading: false,
        error: null,
      });
    } catch (error) {
      if (pdfConvertGenerationRef.current !== generationId) return;
      setPdfConvertPreview({
        sourcePath: node.path,
        sourceName: node.name,
        outPath,
        markdown: null,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function confirmPdfConvert() {
    if (!pdfConvertPreview || pdfConvertPreview.loading || pdfConvertPreview.error) return;
    if (pdfConvertSubmitting) return;
    const markdown = pdfConvertPreview.markdown ?? "";
    const outPath = pdfConvertPreview.outPath;
    try {
      setPdfConvertSubmitting(true);
      const exists = await invoke<boolean>("path_exists", { path: outPath });
      if (exists) {
        const replace = await confirm(
          `"${fileNameFromPath(outPath)}" already exists at this location. Replace it?`,
          { title: "Convert", kind: "warning" },
        );
        if (!replace) {
          setPdfConvertSubmitting(false);
          return;
        }
      }
      await invoke("write_text_file", { path: outPath, contents: markdown });
    } catch (error) {
      setPdfConvertSubmitting(false);
      window.alert(error instanceof Error ? error.message : String(error));
      return;
    }

    closePdfConvertPreview();
    await reloadWorkspaceTree();
    await selectNode(
      {
        name: fileNameFromPath(outPath),
        path: outPath,
        kind: "file",
      },
      { reload: true },
    );
  }

  async function selectNode(node: FileNode, options?: { reload?: boolean }) {
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

    if (isPdfDocument(node.path)) {
      await convertPdfToMarkdown(node);
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
    if (openDocuments[id] && !options?.reload) {
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
        const [notes, criteria, sidecarLink] = await Promise.all([
          loadDocumentNotes(node.path),
          loadDocumentCriteria(node.path),
          loadNotionEssayLink(node.path),
        ]);
        const notionFields = {
          ...EMPTY_NOTION_ESSAY_FIELDS,
          ...notionFieldsFromLink(mergeNotionEssayLink(notionLinkFromFields(meta), sidecarLink)),
        };
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
          ...notionFields,
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
      ...EMPTY_NOTION_ESSAY_FIELDS,
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
    const base = sanitizeFileBasename(title) || "Untitled";
    const seed = markdownForDisk("", {
      postTitle: title,
      subtitle: "",
      notionParentPageId: item.notionPageId ?? "",
      notionEssayPageId: "",
      notionRenameParent: false,
    });

    let outPath = normalizeMarkdownSavePath(joinPath(folder, `${base}.md`));
    let suffix = 2;
    while (await invoke<boolean>("path_exists", { path: outPath })) {
      outPath = normalizeMarkdownSavePath(joinPath(folder, `${base} ${suffix}.md`));
      suffix += 1;
    }

    try {
      await invoke("write_text_file", { path: outPath, contents: seed });
      if (notes) {
        await invoke("write_text_file", {
          path: documentNotesSidecarPath(outPath),
          contents: notes,
        });
      }
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
        try {
          await saveNotionEssayLink(outPath, {
            parentPageId: item.notionPageId,
            essayPageId: "",
            renameParent: false,
            parentUrl: "",
            essayUrl: "",
            publicUrl: "",
          });
        } catch {
          // Sync can still create a new database page if this write fails.
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
    const next = finderNameToPosixSegment(fr.draft.trim());
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
      const st = {
        path: newPath,
        draft: posixSegmentToFinderName(bn),
        originalBasename: bn,
      };
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

  const notesDocumentTitle =
    titleRenameDraft !== null
      ? titleRenameDraft.trim() || "Untitled"
      : editorTitleBase.trim() || "Untitled";
  const activeSourcePath = (activeDocument?.sourcePath || scratchDiskPath || "").trim();
  const notionEssayTitle =
    (activeDocument?.postTitle ?? "").trim() || editorTitleBase.trim() || "Untitled";

  useEffect(() => {
    if (!isTauriRuntime()) {
      setNotionConnected(false);
      return;
    }
    if (isSettingsOpen) return;
    let cancelled = false;
    void getNotionIdeasConfig()
      .then((config) => {
        if (!cancelled) setNotionConnected(Boolean(config.connected));
      })
      .catch(() => {
        if (!cancelled) setNotionConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isTauriRuntime() || !activeSourcePath) {
      notionEssayLinkRef.current = null;
      setNotionEssayLink(null);
      return;
    }
    const fromDoc = notionLinkFromFields({
      notionParentPageId: activeDocument?.notionParentPageId,
      notionEssayPageId: activeDocument?.notionEssayPageId,
      notionRenameParent: activeDocument?.notionRenameParent,
      notionParentUrl: activeDocument?.notionParentUrl,
      notionEssayUrl: activeDocument?.notionEssayUrl,
      publicUrl: activeDocument?.publicUrl,
    });
    let cancelled = false;
    const tabId = activeTabId;
    void loadNotionEssayLink(activeSourcePath).then((sidecar) => {
      if (cancelled) return;
      const merged = mergeNotionEssayLink(fromDoc, sidecar);
      notionEssayLinkRef.current = merged;
      setNotionEssayLink(merged);
      if (merged && tabId) {
        setOpenDocuments((prev) => {
          const current = prev[tabId];
          if (!current) return prev;
          const fields = notionFieldsFromLink(merged);
          if (
            current.notionParentPageId === fields.notionParentPageId &&
            current.notionEssayPageId === fields.notionEssayPageId &&
            current.notionParentUrl === fields.notionParentUrl &&
            current.notionEssayUrl === fields.notionEssayUrl &&
            current.publicUrl === fields.publicUrl
          ) {
            return prev;
          }
          return { ...prev, [tabId]: { ...current, ...fields } };
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeSourcePath,
    activeTabId,
    activeDocument?.notionParentPageId,
    activeDocument?.notionEssayPageId,
    activeDocument?.notionRenameParent,
    activeDocument?.notionParentUrl,
    activeDocument?.notionEssayUrl,
    activeDocument?.publicUrl,
  ]);

  useEffect(() => {
    const onMatched = (event: Event) => {
      const updates = (event as CustomEvent<PublishedUrlUpdate[]>).detail;
      if (!Array.isArray(updates) || updates.length === 0) return;
      setOpenDocuments((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [id, doc] of Object.entries(prev)) {
          const update = updates.find((item) =>
            isExactOpenDocument(item.path, doc.sourcePath || id),
          );
          if (!update || doc.publicUrl === update.publicUrl) continue;
          next[id] = { ...doc, publicUrl: update.publicUrl };
          changed = true;
        }
        return changed ? next : prev;
      });
      const activePath = (activeDocument?.sourcePath || scratchDiskPath || "").trim();
      const activeUpdate = updates.find((item) => isExactOpenDocument(item.path, activePath));
      if (activeUpdate) {
        const current = notionEssayLinkRef.current;
        const nextLink = {
          parentPageId: current?.parentPageId ?? "",
          essayPageId: current?.essayPageId ?? "",
          renameParent: Boolean(current?.renameParent),
          parentUrl: current?.parentUrl ?? "",
          essayUrl: current?.essayUrl ?? "",
          publicUrl: activeUpdate.publicUrl,
        };
        notionEssayLinkRef.current = nextLink;
        setNotionEssayLink(nextLink);
      }
    };
    window.addEventListener(PUBLIC_URLS_MATCHED_EVENT, onMatched);
    return () => window.removeEventListener(PUBLIC_URLS_MATCHED_EVENT, onMatched);
  }, [activeDocument?.sourcePath, scratchDiskPath]);

  useEffect(() => {
    setTitleRenameDraft(null);
    setHeadlinePairs([]);
    setHeadlinePairsError(null);
    setSelectedHeadlineIndex(null);
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
    (Boolean(activeTabId && activeDocument) || openTabIds.length === 0) &&
    !saveAsModalOpen &&
    !podcastNotesPreviewOpen;

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
  const relatedExcerpt = useMemo(() => {
    if (tiptapEditor) {
      return proofreadPlainTextAndPositions(tiptapEditor.state.doc).text.slice(0, RELATED_DRAFT_CHARS);
    }
    return excerptFromMarkdown(editorText, RELATED_DRAFT_CHARS);
  }, [tiptapEditor, editorText]);
  const showReadabilityHighlights = readabilityPanelOpen && mode === "edit";
  const showMechanicsUnderlines =
    readabilityPanelOpen && (mode === "edit" || (mode === "notes" && relatedProofreadIssues.length > 0));
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
    void ensureHunspellLoaded();
  }, []);

  useEffect(() => {
    aiProofreadIssuesRef.current = aiProofreadIssues;
  }, [aiProofreadIssues]);

  useEffect(() => {
    relatedProofreadIssuesRef.current = relatedProofreadIssues;
  }, [relatedProofreadIssues]);

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
    relatedProofreadIssuesRef.current = [];
    setRelatedProofreadIssues([]);
    relatedLinkedPathsRef.current = [];
    relatedItemsRef.current = [];
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

  const persistRelatedIssues = useCallback((issues: ProofreadIssue[]) => {
    const prev = relatedProofreadIssuesRef.current;
    const unchanged =
      prev.length === issues.length &&
      prev.every(
        (issue, index) =>
          issue.start === issues[index]!.start &&
          issue.end === issues[index]!.end &&
          issue.text === issues[index]!.text &&
          issue.message === issues[index]!.message &&
          issue.relatedPath === issues[index]!.relatedPath,
      );
    if (unchanged) return;
    relatedProofreadIssuesRef.current = issues;
    setRelatedProofreadIssues(issues);
  }, []);

  const extraProofreadIssues = useCallback(
    () => [...aiProofreadIssuesRef.current, ...relatedProofreadIssuesRef.current],
    [],
  );

  const persistExtraIssues = useCallback(
    (issues: ProofreadIssue[]) => {
      persistAiIssues(issues.filter((issue) => issue.type === "ai"));
      persistRelatedIssues(issues.filter((issue) => issue.type === "related"));
    },
    [persistAiIssues, persistRelatedIssues],
  );

  /** Live rule-based mechanics (Spelling / Grammar / Suggestions) while the document is editable. */
  useEffect(() => {
    if (!tiptapEditor || !editorEditable) {
      return;
    }

    const runSync = () => {
      void syncMechanicsProofread(
        tiptapEditor,
        setProofreadIssues,
        extraProofreadIssues,
        persistExtraIssues,
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
  }, [tiptapEditor, editorEditable, extraProofreadIssues, persistExtraIssues]);

  const refreshMechanicsProofread = useCallback(() => {
    if (!tiptapEditor) return;
    void syncMechanicsProofread(
      tiptapEditor,
      setProofreadIssues,
      extraProofreadIssues,
      persistExtraIssues,
    );
  }, [tiptapEditor, extraProofreadIssues, persistExtraIssues]);

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
        () => [...located, ...relatedProofreadIssuesRef.current],
        persistExtraIssues,
      );
    } catch (e) {
      setAiCheckError(e instanceof Error ? e.message : String(e));
    } finally {
      setAiCheckRunning(false);
    }
  }, [tiptapEditor, persistAiIssues, persistExtraIssues]);

  const applyRelatedEssayItems = useCallback(
    async (items: RelatedEssayItem[]): Promise<string | null> => {
      if (!tiptapEditor || !activeSourcePath) return "Save this essay first.";
      const hydrated = await hydrateRelatedEssayUrls(items);
      relatedItemsRef.current = hydrated;
      const text = proofreadPlainTextAndPositions(tiptapEditor.state.doc).text;
      const hrefs = collectDocLinkHrefs(tiptapEditor.state.doc);
      const linked = uniqueLinkedRelatedPaths({
        linkedPaths: relatedLinkedPathsRef.current,
        items: hydrated,
        hrefs,
      });
      relatedLinkedPathsRef.current = linked;
      await saveRelatedEssaySidecar(activeSourcePath, { items: hydrated, linkedPaths: linked });
      if (linked.length >= MAX_RELATED_LINKS) {
        persistRelatedIssues([]);
        refreshMechanicsProofread();
        return "This essay already links 2 related essays.";
      }
      const issues = locateRelatedPhrasesInText(text, hydrated).filter(
        (issue) => !issue.relatedPath || !linked.includes(issue.relatedPath),
      );
      persistRelatedIssues(issues);
      refreshMechanicsProofread();
      if (hydrated.length > 0 && issues.length === 0) {
        return "Found related essays, but no matching phrases in this draft.";
      }
      return null;
    },
    [tiptapEditor, activeSourcePath, persistRelatedIssues, refreshMechanicsProofread],
  );

  useEffect(() => {
    if (!activeSourcePath || !tiptapEditor) return;
    let cancelled = false;
    void loadRelatedEssaySidecar(activeSourcePath).then((sidecar) => {
      if (cancelled) return;
      relatedItemsRef.current = sidecar.items;
      const hrefs = collectDocLinkHrefs(tiptapEditor.state.doc);
      relatedLinkedPathsRef.current = uniqueLinkedRelatedPaths({
        linkedPaths: sidecar.linkedPaths,
        items: sidecar.items,
        hrefs,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [activeSourcePath, tiptapEditor, editorInstanceKey]);

  useEffect(() => {
    syncRelatedEssayLinkingRef({
      urlForPath: (path) => {
        const item = relatedItemsRef.current.find((entry) => entry.path === path);
        return item ? preferredRelatedUrl(item) : "";
      },
      resolveUrl: async (path, title) => {
        const linkedPath = path.trim();
        const existing = relatedItemsRef.current.find((entry) => entry.path === linkedPath);
        const fromItem = existing ? preferredRelatedUrl(existing) : "";
        if (fromItem) return fromItem;
        const href = await resolveRelatedEssayHref({
          path: linkedPath,
          title: title?.trim() || existing?.title,
        });
        if (href && existing) {
          relatedItemsRef.current = relatedItemsRef.current.map((entry) =>
            entry.path === linkedPath ? { ...entry, publicUrl: href } : entry,
          );
        }
        return href;
      },
      applyLink: (from, to, href) => {
        if (!tiptapEditor) return false;
        return setLinkOnRange(tiptapEditor, from, to, href);
      },
      onLinkEssay: ({ path, start, end }) => {
        const linkedPath = path.trim();
        const nextLinked = uniqueStrings([...relatedLinkedPathsRef.current, linkedPath]);
        relatedLinkedPathsRef.current = nextLinked;
        persistRelatedIssues(
          relatedIssuesAfterLinking(relatedProofreadIssuesRef.current, nextLinked, {
            path: linkedPath,
            start,
            end,
          }),
        );
        if (activeSourcePath) {
          void saveRelatedEssaySidecar(activeSourcePath, {
            items: relatedItemsRef.current,
            linkedPaths: nextLinked,
          });
        }
      },
    });
  }, [activeSourcePath, persistRelatedIssues, tiptapEditor]);

  const handleGenerateHeadlines = useCallback(async () => {
    if (!isTauriRuntime()) {
      setHeadlinePairsError("Headline suggestions are only available in the Harvy desktop app.");
      return;
    }
    if (!aiCheckConfig?.enabled || !aiCheckConfig.hasApiKey) {
      setHeadlinePairsError("Enable AI and add an API key in Settings → Artificial Intelligence first.");
      return;
    }
    const essay = tiptapEditor
      ? proofreadPlainTextAndPositions(tiptapEditor.state.doc).text
      : editorText;
    if (!essay.trim()) {
      setHeadlinePairsError("Nothing to title — the document is empty.");
      return;
    }
    setHeadlinePairsRunning(true);
    setHeadlinePairsFromShots(false);
    setHeadlinePairsError(null);
    try {
      const result = await generateHeadlinePairs(essay, readHeadlineStylePrompt());
      setHeadlinePairs(result.pairs);
      setSelectedHeadlineIndex(null);
    } catch (e) {
      setHeadlinePairsError(e instanceof Error ? e.message : String(e));
    } finally {
      setHeadlinePairsRunning(false);
    }
  }, [aiCheckConfig?.enabled, aiCheckConfig?.hasApiKey, editorText, tiptapEditor]);

  const handleGenerateHeadlinesFromShots = useCallback(async () => {
    if (!isTauriRuntime()) {
      setHeadlinePairsError("Headline suggestions are only available in the Harvy desktop app.");
      return;
    }
    if (!aiCheckConfig?.enabled || !aiCheckConfig.hasApiKey) {
      setHeadlinePairsError("Enable AI and add an API key in Settings → Artificial Intelligence first.");
      return;
    }
    const essay = tiptapEditor
      ? proofreadPlainTextAndPositions(tiptapEditor.state.doc).text
      : editorText;
    if (!essay.trim()) {
      setHeadlinePairsError("Nothing to title — the document is empty.");
      return;
    }
    setHeadlinePairsRunning(true);
    setHeadlinePairsFromShots(true);
    setHeadlinePairsError(null);
    try {
      const images = await loadHeadlineShotsForVision();
      if (images.length === 0) {
        setHeadlinePairsError("Add screenshots in Research → Headlines first.");
        return;
      }
      const result = await generateHeadlinePairsFromShots(
        essay,
        images,
        readHeadlineStylePrompt(),
      );
      setHeadlinePairs(result.pairs);
      setSelectedHeadlineIndex(null);
    } catch (e) {
      setHeadlinePairsError(e instanceof Error ? e.message : String(e));
    } finally {
      setHeadlinePairsRunning(false);
      setHeadlinePairsFromShots(false);
    }
  }, [aiCheckConfig?.enabled, aiCheckConfig?.hasApiKey, editorText, tiptapEditor]);

  function handleSelectHeadlinePair(pair: HeadlinePair, index: number) {
    updateActiveDocumentPostTitle(pair.title);
    updateActiveDocumentSubtitle(pair.subtitle);
    setSelectedHeadlineIndex(index);
  }

  useEffect(() => {
    setSpellingDocumentKey(editorInstanceKey);
  }, [editorInstanceKey]);

  useEffect(() => {
    proofreadDecorationsViewRef.relatedOnly = mode === "notes";
    if (!tiptapEditor) return;
    setMechanicsUnderlinesVisible(tiptapEditor.view, showMechanicsUnderlines);
    refreshMechanicsProofread();
  }, [showMechanicsUnderlines, mode, tiptapEditor, refreshMechanicsProofread]);

  useEffect(() => {
    syncSpellingContextMenuRef({
      enabled: showMechanicsUnderlines && editorEditable,
      issues:
        mode === "notes"
          ? proofreadIssues.filter((issue) => issue.type === "related")
          : proofreadIssues,
      documentKey: editorInstanceKey,
      onRefresh: refreshMechanicsProofread,
    });
  }, [
    showMechanicsUnderlines,
    editorEditable,
    proofreadIssues,
    editorInstanceKey,
    refreshMechanicsProofread,
    mode,
  ]);

  const copyDocumentFallbackMarkdown = useMemo(
    () => activeDocument?.content ?? (openTabIds.length === 0 ? scratchDraftContent : ""),
    [activeDocument?.content, openTabIds.length, scratchDraftContent],
  );

  const handleCopyDocument = useCallback(async () => {
    return copyDocumentToClipboard(tiptapEditor, copyDocumentFallbackMarkdown, workspaceRootPath);
  }, [tiptapEditor, copyDocumentFallbackMarkdown, workspaceRootPath]);

  const handlePrintDocument = useCallback(() => {
    void printDocumentFromEditor(
      tiptapEditor,
      copyDocumentFallbackMarkdown,
      editorTitleBase,
    ).catch((e) => {
      window.alert(`Print failed: ${e instanceof Error ? e.message : String(e)}`);
    });
  }, [tiptapEditor, copyDocumentFallbackMarkdown, editorTitleBase]);
  printDocumentRef.current = handlePrintDocument;

  const performNotionEssaySync = useCallback(
    async (opts?: { silent?: boolean }): Promise<NotionEssayLink | null> => {
      if (notionSyncRunningRef.current) return null;
      if (!isTauriRuntime()) {
        if (!opts?.silent) {
          window.alert("Sync with Notion is only available in the Harvy desktop app.");
        }
        return null;
      }
      if (!notionConnected) {
        if (!opts?.silent) {
          window.alert("Connect Notion in Settings → Research before syncing.");
        }
        return null;
      }
      const sourcePath =
        (activeDocument?.sourcePath || scratchDiskPath || "").trim();
      if (!sourcePath) {
        if (!opts?.silent) {
          window.alert("Save this essay before syncing with Notion.");
        }
        return null;
      }

      const markdown = getDocumentMarkdown(
        tiptapEditor,
        activeDocument?.content ?? scratchDraftContent,
      );
      const title =
        (activeDocument?.postTitle ?? "").trim() || editorTitleBase.trim() || "Untitled";
      const payload = `${title}\0${markdown}`;
      const link = notionEssayLinkRef.current;
      if (opts?.silent && (!link?.essayPageId || lastNotionSyncedRef.current === payload)) {
        return link ?? null;
      }

      notionSyncRunningRef.current = true;
      setNotionSyncRunning(true);
      try {
        const result = await syncEssayWithNotion({
          title,
          markdown,
          parentPageId: link?.parentPageId,
          essayPageId: link?.essayPageId,
          renameParent: link?.renameParent,
        });
        const nextLink: NotionEssayLink = {
          parentPageId: result.parentPageId,
          essayPageId: result.essayPageId,
          renameParent: result.renameParent,
          parentUrl: result.parentUrl || link?.parentUrl || "",
          essayUrl: result.essayUrl || link?.essayUrl || "",
          publicUrl: link?.publicUrl || activeDocument?.publicUrl || "",
        };
        const notionFields = notionFieldsFromLink(nextLink);
        const idsChanged =
          (link?.parentPageId ?? "") !== nextLink.parentPageId ||
          (link?.essayPageId ?? "") !== nextLink.essayPageId ||
          Boolean(link?.renameParent) !== nextLink.renameParent ||
          (link?.parentUrl ?? "") !== nextLink.parentUrl ||
          (link?.essayUrl ?? "") !== nextLink.essayUrl;
        await saveNotionEssayLink(sourcePath, nextLink);
        if (idsChanged) {
          await invoke("write_text_file", {
            path: sourcePath,
            contents: markdownForDisk(markdown, {
              postTitle: title,
              subtitle: activeDocument?.subtitle ?? "",
              ...notionFields,
            }),
          });
        }
        notionEssayLinkRef.current = nextLink;
        setNotionEssayLink(nextLink);
        lastNotionSyncedRef.current = payload;
        notionSyncedPathRef.current = sourcePath;
        if (activeTabId) {
          setOpenDocuments((prev) => {
            const current = prev[activeTabId];
            if (!current) return prev;
            return {
              ...prev,
              [activeTabId]: {
                ...current,
                ...notionFields,
                ...(idsChanged
                  ? {
                      lastSavedContent: markdown,
                      lastSavedPostTitle: current.postTitle,
                    }
                  : {}),
              },
            };
          });
        }
        return nextLink;
      } catch (e) {
        if (!opts?.silent) {
          window.alert(e instanceof Error ? e.message : String(e));
        } else {
          console.error(e);
        }
        return null;
      } finally {
        notionSyncRunningRef.current = false;
        setNotionSyncRunning(false);
      }
    },
    [
      activeDocument?.content,
      activeDocument?.postTitle,
      activeDocument?.sourcePath,
      activeDocument?.subtitle,
      activeTabId,
      editorTitleBase,
      notionConnected,
      scratchDiskPath,
      scratchDraftContent,
      tiptapEditor,
    ],
  );

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
    const link = await performNotionEssaySync();
    if (!link?.parentPageId) return;
    try {
      await markNotionEssayPublished(link.parentPageId, todayLocalIsoDate());
    } catch (e) {
      window.alert(
        e instanceof Error
          ? e.message
          : "Copied and synced, but Notion Status / publish date could not be updated.",
      );
    }
  }, [
    publishUrl,
    tiptapEditor,
    copyDocumentFallbackMarkdown,
    workspaceRootPath,
    performNotionEssaySync,
  ]);

  useEffect(() => {
    const payload = `${notionEssayTitle}\0${activeDocument?.content ?? scratchDraftContent}`;
    if (notionSyncedPathRef.current !== activeSourcePath) {
      notionSyncedPathRef.current = activeSourcePath || null;
      lastNotionSyncedRef.current = payload;
      return;
    }
    if (!notionConnected || !notionEssayLink?.essayPageId || !activeSourcePath) return;
    if (payload === lastNotionSyncedRef.current) return;
    const timer = window.setTimeout(() => {
      void performNotionEssaySync({ silent: true });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [
    activeDocument?.content,
    activeSourcePath,
    notionConnected,
    notionEssayLink?.essayPageId,
    notionEssayTitle,
    performNotionEssaySync,
    scratchDraftContent,
  ]);

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

  const applyActiveDocumentTitleRename = useCallback(
    async (rawBase: string): Promise<TitleRenameResult> => {
      if (openTabIdsRef.current.length === 0) {
        const displayLabel = scratchDocumentTitleRef.current.trim() || "Untitled";
        const { base: displayBase, extWithDot } = splitFileBaseAndExtension(displayLabel);
        let nextBase = sanitizeFileBasename(rawBase);
        if (!nextBase) nextBase = "Untitled";
        const diskPath = scratchDiskPathRef.current;
        if (nextBase === displayBase) {
          return {
            ok: true,
            id: "",
            title: displayLabel,
            sourcePath: diskPath ?? "",
            postTitle: nextBase,
          };
        }
        const nameErr = validateFolderName(nextBase);
        if (nameErr) {
          window.alert(nameErr);
          return { ok: false };
        }
        const newTitle = extWithDot ? `${nextBase}${extWithDot}` : nextBase;
        let nextPath = diskPath ?? "";
        if (isTauriRuntime() && diskPath) {
          const pathBasename = fileNameFromPath(diskPath);
          const { extWithDot: diskExt } = splitFileBaseAndExtension(pathBasename);
          const newFileName = diskExt ? `${nextBase}${diskExt}` : nextBase;
          const targetPath = joinPath(parentDirectory(diskPath), newFileName);
          if (targetPath !== diskPath) {
            try {
              await invoke("rename_fs_path", { fromPath: diskPath, toPath: targetPath });
            } catch (e) {
              window.alert(e instanceof Error ? e.message : String(e));
              return { ok: false };
            }
            nextPath = targetPath;
            scratchDiskPathRef.current = targetPath;
            setScratchDiskPath(targetPath);
          }
        }
        scratchDocumentTitleRef.current = newTitle;
        setScratchDocumentTitle(newTitle);
        return { ok: true, id: "", title: newTitle, sourcePath: nextPath, postTitle: nextBase };
      }

      const id = activeTabIdRef.current;
      const doc = id ? openDocumentsRef.current[id] : null;
      if (!id || !doc) return { ok: false };

      const pathBasename = doc.sourcePath.trim()
        ? fileNameFromPath(doc.sourcePath)
        : "";
      const displayLabel = doc.title.trim() ? doc.title : pathBasename || "Untitled";
      const { base: displayBase } = splitFileBaseAndExtension(displayLabel);

      let nextBase = sanitizeFileBasename(rawBase);
      if (!nextBase) nextBase = "Untitled";
      if (nextBase === displayBase) {
        if (doc.postTitle !== nextBase) {
          const aligned = { ...doc, postTitle: nextBase };
          openDocumentsRef.current = { ...openDocumentsRef.current, [id]: aligned };
          setOpenDocuments((prev) => {
            const d = prev[id];
            if (!d) return prev;
            const next = { ...prev, [id]: { ...d, postTitle: nextBase } };
            openDocumentsRef.current = next;
            return next;
          });
        }
        return {
          ok: true,
          id,
          title: displayLabel,
          sourcePath: doc.sourcePath,
          postTitle: nextBase,
        };
      }

      const nameErr = validateFolderName(nextBase);
      if (nameErr) {
        window.alert(nameErr);
        return { ok: false };
      }

      const canRenameOnDisk = isTauriRuntime() && Boolean(doc.sourcePath.trim());

      if (!canRenameOnDisk) {
        const { extWithDot: displayExt } = splitFileBaseAndExtension(displayLabel);
        const newTitle = displayExt ? `${nextBase}${displayExt}` : nextBase;
        openDocumentsRef.current = {
          ...openDocumentsRef.current,
          [id]: { ...doc, title: newTitle, postTitle: nextBase },
        };
        setOpenDocuments((prev) => {
          const d = prev[id];
          if (!d) return prev;
          const next = { ...prev, [id]: { ...d, title: newTitle, postTitle: nextBase } };
          openDocumentsRef.current = next;
          return next;
        });
        return { ok: true, id, title: newTitle, sourcePath: doc.sourcePath, postTitle: nextBase };
      }

      const { extWithDot } = splitFileBaseAndExtension(pathBasename || displayLabel);
      const newFileName = extWithDot ? `${nextBase}${extWithDot}` : nextBase;
      const sourcePath = doc.sourcePath;
      const parent = parentDirectory(sourcePath);
      const targetPath = joinPath(parent, newFileName);
      if (targetPath === sourcePath) {
        return { ok: true, id, title: doc.title, sourcePath, postTitle: nextBase };
      }

      try {
        await invoke("rename_fs_path", { fromPath: sourcePath, toPath: targetPath });
        await renameDocumentNotesSidecar(sourcePath, targetPath);
        await renameDocumentCriteriaSidecar(sourcePath, targetPath);
        await renameNotionEssaySidecar(sourcePath, targetPath);
        await renameRelatedEssaySidecar(sourcePath, targetPath);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
        return { ok: false };
      }

      const savedTitle = fileNameFromPath(targetPath);
      const { [id]: _removed, ...rest } = openDocumentsRef.current;
      openDocumentsRef.current = {
        ...rest,
        [targetPath]: {
          ...doc,
          id: targetPath,
          sourcePath: targetPath,
          title: savedTitle,
          postTitle: nextBase,
        },
      };
      activeTabIdRef.current = targetPath;
      setOpenDocuments((prev) => {
        const d = prev[id];
        if (!d) return prev;
        const nextDoc: WorkspaceDocument = {
          ...d,
          id: targetPath,
          sourcePath: targetPath,
          title: savedTitle,
          postTitle: nextBase,
        };
        const { [id]: _drop, ...nextRest } = prev;
        const next = { ...nextRest, [targetPath]: nextDoc };
        openDocumentsRef.current = next;
        return next;
      });
      setOpenTabIds((prev) => {
        const next = prev.map((tabId) => (tabId === id ? targetPath : tabId));
        openTabIdsRef.current = next;
        return next;
      });
      activeTabIdRef.current = targetPath;
      setActiveTabId((cur) => (cur === id ? targetPath : cur));
      setSelectedPath((p) => (p === id ? targetPath : p));
      if (scratchDiskPathRef.current === id) {
        scratchDiskPathRef.current = targetPath;
        setScratchDiskPath(targetPath);
      }
      await reloadWorkspaceTree();
      return { ok: true, id: targetPath, title: savedTitle, sourcePath: targetPath, postTitle: nextBase };
    },
    [reloadWorkspaceTree],
  );
  applyTitleRenameRef.current = applyActiveDocumentTitleRename;

  const commitActiveDocumentTitleRename = useCallback(
    async (rawBase: string) => (await applyActiveDocumentTitleRename(rawBase)).ok,
    [applyActiveDocumentTitleRename],
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
      openDocumentTrailPath={openDocumentTrailPath}
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
      relatedSourcePath={activeSourcePath}
      relatedTitle={
        (activeDocument?.postTitle ?? "").trim() || editorTitleBase.trim() || "Untitled"
      }
      relatedExcerpt={relatedExcerpt}
      workspaceTree={workspaceTree}
      relatedAiReady={Boolean(aiCheckConfig?.enabled && aiCheckConfig.hasApiKey)}
      showRelatedEssays={showRelatedEssays}
      onRelatedItemsFound={applyRelatedEssayItems}
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
      className={`harvy-title-bar-drag h-[var(--harvy-tab-bar-height)] overflow-hidden transition-[background-color,border-color,box-shadow] duration-500 ease-in-out ${
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
              showHeadlinesView={showHeadlinesView}
              showAvatarView={showAvatarView}
              collectViewOrder={collectViewOrder}
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
              showTitleGeneration={showTitleGeneration}
              headlinesRunning={headlinePairsRunning}
              headlinesRunningFromHeadlines={headlinePairsFromShots}
              headlinesError={headlinePairsError}
              headlinePairs={headlinePairs}
              selectedHeadlineIndex={selectedHeadlineIndex}
              onGenerateHeadlines={handleGenerateHeadlines}
              onGenerateHeadlinesFromShots={handleGenerateHeadlinesFromShots}
              onSelectHeadlinePair={handleSelectHeadlinePair}
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
              onPrint={handlePrintDocument}
              podcastNotesEnabled={Boolean(
                showPodcastNotes && aiCheckConfig?.enabled && aiCheckConfig.hasApiKey,
              )}
              podcastNotesRunning={
                podcastNotesRunning ||
                podcastNotesPreviewOpen ||
                (saveAsModalOpen && saveAsPurpose === "podcast-notes")
              }
              onSyncWithNotion={() => void performNotionEssaySync()}
              notionSyncEnabled={notionConnected}
              notionSyncRunning={notionSyncRunning}
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
              showHeadlinesView={showHeadlinesView}
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
                showHeadlinesView={showHeadlinesView}
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
        className={`pointer-events-none absolute top-0 z-30 flex h-[var(--harvy-tab-bar-height)] items-center rounded-md px-0.5 transition-[opacity,background-color,left] duration-500 ease-in-out ${
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
        showPodcastNotes={showPodcastNotes}
        onShowPodcastNotesChange={handleShowPodcastNotesChange}
        showTitleGeneration={showTitleGeneration}
        onShowTitleGenerationChange={handleShowTitleGenerationChange}
        showRelatedEssays={showRelatedEssays}
        onShowRelatedEssaysChange={handleShowRelatedEssaysChange}
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
        showHeadlinesView={showHeadlinesView}
        showAvatarView={showAvatarView}
        onShowOutliersViewChange={handleShowOutliersViewChange}
        onShowCollectViewChange={handleShowCollectViewChange}
        onShowHeadlinesViewChange={handleShowHeadlinesViewChange}
        onShowAvatarViewChange={handleShowAvatarViewChange}
        collectViewOrder={collectViewOrder}
        onCollectViewOrderChange={handleCollectViewOrderChange}
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
      <PodcastNotesPreviewModal
        open={podcastNotesPreviewOpen}
        markdown={podcastNotesMarkdown}
        generating={podcastNotesRunning}
        error={podcastNotesPreviewError}
        onClose={closePodcastNotesPreview}
        onExport={() => void confirmPodcastNotesExport()}
        onPrint={() => {
          if (!podcastNotesMarkdown?.trim()) return;
          void printMarkdownDocument(
            "Podcast Notes",
            ensurePodcastNotesBullets(podcastNotesMarkdown),
          ).catch((e) => {
            window.alert(`Print failed: ${e instanceof Error ? e.message : String(e)}`);
          });
        }}
        onShare={(event) => {
          if (!podcastNotesMarkdown?.trim()) return;
          void shareMarkdownPdf(
            "Podcast Notes",
            ensurePodcastNotesBullets(podcastNotesMarkdown),
            defaultPodcastNotesPdfFileName(editorTitleBase),
            shareAnchorFromElement(event.currentTarget),
          ).catch((e) => {
            window.alert(`Share failed: ${e instanceof Error ? e.message : String(e)}`);
          });
        }}
        onRetry={retryPodcastNotesPreview}
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
      <PdfConvertPreviewModal
        open={pdfConvertPreview !== null}
        sourceName={pdfConvertPreview?.sourceName ?? ""}
        sourcePath={pdfConvertPreview?.sourcePath ?? ""}
        workspaceRootPath={workspaceRootPath}
        markdown={pdfConvertPreview?.markdown ?? null}
        loading={pdfConvertPreview?.loading ?? false}
        error={pdfConvertPreview?.error ?? null}
        submitting={pdfConvertSubmitting}
        onClose={closePdfConvertPreview}
        onConvert={() => void confirmPdfConvert()}
        onRetry={
          pdfConvertPreview
            ? () =>
                void convertPdfToMarkdown({
                  name: pdfConvertPreview.sourceName,
                  path: pdfConvertPreview.sourcePath,
                  kind: "file",
                })
            : undefined
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
