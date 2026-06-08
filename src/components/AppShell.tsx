import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { confirm, open, save } from "@tauri-apps/plugin-dialog";
import type { Editor } from "@tiptap/core";
import { PanelLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  readStoredThemeMode,
  resolveTheme,
  writeStoredThemeMode,
  type ThemeMode,
} from "../theme/themeMode";
import { AboutModal } from "./settings/AboutModal";
import { SettingsModal } from "./settings/SettingsModal";
import { SidebarLeft } from "./SidebarLeft";
import { ChromeSidebarToggleButton } from "./ChromeSidebarToggleButton";
import { SidebarRight } from "./SidebarRight";
import { EditorToolbar } from "./EditorToolbar";
import { EditorAmbientControls } from "./EditorAmbientControls";
import { EditorCanvas } from "./EditorCanvas";
import { FloatingTextMenu } from "./FloatingTextMenu";
import { EditorDocumentHeader } from "./EditorDocumentHeader";
import { OpenWindowsBar } from "./OpenWindowsBar";
import { SaveAsModal, type SaveAsOrganizeMode } from "./SaveAsModal";
import type { EditorCommand } from "../features/editor/commands";
import { documentTextForStats, ingestTextFileContent } from "../features/editor/documentMarkdown";
import { setFileMenuHandlers } from "../features/menu/fileMenuBridge";
import { setupNativeAppMenu } from "../features/menu/setupNativeAppMenu";
import { runEditorFormat, type LinkFormatOptions } from "../features/editor/editorFormatActions";
import { calculateEditorStats } from "../features/editor/stats";
import { pickAndImportWorkspaceImage } from "../features/editor/imageAssets";
import { copyDocumentToClipboard } from "../features/editor/documentClipboard";
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
  isTextPreviewable,
} from "../features/workspace/tree";
import { isPathUnderWorkspaceRoot } from "../features/workspace/workspacePaths";
import type { FileNode, WorkspaceDocument } from "../features/workspace/types";
import { nextActiveTabIdAfterClose, toPageTabs } from "../features/tabs/pageTabs";
import {
  defaultPdfFileName,
  defaultSaveFileName,
  fileNameFromPath,
  getDocumentMarkdown,
  isTauriRuntime,
  normalizeMarkdownSavePath,
  normalizePdfSavePath,
} from "../features/save/saveRuntime";
import {
  readWritingAssistancePrefs,
  writeWritingAssistancePrefs,
} from "../features/writing-assistance/writingAssistanceSettings";
import type { SidebarToolsMode } from "../features/sidebar/sidebarToolsMode";
import { setMechanicsUnderlinesVisible } from "../features/proofread/mechanicsUnderlineLayer";
import {
  grammarDecorationsKey,
  writingAssistanceViewRef,
} from "../features/writing-assistance/writingAssistanceExtension";
import { proofreadPlainTextAndPositions } from "../features/proofread/proofreadPlainMap";
import { syncMechanicsProofread } from "../features/proofread/mechanics/syncMechanicsProofread";
import type { ProofreadIssue } from "../features/proofread/types";
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
  };
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
  const [mode, setMode] = useState<SidebarToolsMode>("outline");
  const [isWorkspaceSidebarOpen, setIsWorkspaceSidebarOpen] = useState(true);
  /** `null` = browse at the selected workspace root. */
  const [workspaceBrowsePath, setWorkspaceBrowsePath] = useState<string | null>(null);
  /** Folder names under the workspace root — excludes volume label. */
  const [breadcrumbFolderSegments, setBreadcrumbFolderSegments] = useState<string[]>([]);
  /** Resolved system volume name (desktop), or generic label on web. */
  const [workspaceVolumeLabel, setWorkspaceVolumeLabel] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [saveAsModalOpen, setSaveAsModalOpen] = useState(false);
  const [saveAsInitialFileName, setSaveAsInitialFileName] = useState("Untitled.md");
  const [saveAsDestinationPath, setSaveAsDestinationPath] = useState<string | null>(null);
  const [saveAsSubmitting, setSaveAsSubmitting] = useState(false);
  const [isTopChromeHidden, setIsTopChromeHidden] = useState(false);
  /** Outline tab: show outline NOTE: instruction blocks in the editor (CSS toggle only; only while Create Outline Mode is on). */
  const [outlineInstructionsVisible, setOutlineInstructionsVisible] = useState(true);
  const [createOutlineMode, setCreateOutlineMode] = useState(false);
  const [readabilityPanelOpen, setReadabilityPanelOpen] = useState(true);

  const exitCreateOutlineMode = useCallback(() => {
    setCreateOutlineMode(false);
    setOutlineInstructionsVisible(true);
  }, []);

  const handleSidebarModeChange = useCallback(
    (next: SidebarToolsMode) => {
      setMode(next);
      if (next === "edit") {
        exitCreateOutlineMode();
      }
    },
    [exitCreateOutlineMode],
  );

  useEffect(() => {
    if (!readabilityPanelOpen) {
      exitCreateOutlineMode();
    }
  }, [readabilityPanelOpen, exitCreateOutlineMode]);
  /** In-memory buffer when no tabs open — not a saved file until persistence exists. */
  const [scratchDraftContent, setScratchDraftContent] = useState("");
  /** When set, scratch buffer last wrote to this path. */
  const [scratchDiskPath, setScratchDiskPath] = useState<string | null>(null);
  /** Scratch Markdown last successfully written to `scratchDiskPath` (or "" before first save). */
  const [scratchLastSavedContent, setScratchLastSavedContent] = useState("");
  /** Display name for the scratch buffer (no tab row); shown in the document header. */
  const [scratchDocumentTitle, setScratchDocumentTitle] = useState("Untitled");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredThemeMode());
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false,
  );

  const [writingAssistancePrefs, setWritingAssistancePrefs] = useState(readWritingAssistancePrefs);

  const [tiptapEditor, setTiptapEditor] = useState<Editor | null>(null);
  const [selectedWordCount, setSelectedWordCount] = useState<number | null>(null);
  const [proofreadBusy, setProofreadBusy] = useState(false);
  const [proofreadIssues, setProofreadIssues] = useState<ProofreadIssue[]>([]);
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

  const handleEditorReady = useCallback((ed: Editor | null) => {
    setTiptapEditor(ed);
  }, []);

  const handleSpellcheckPref = useCallback((spellcheck: boolean) => {
    setWritingAssistancePrefs(writeWritingAssistancePrefs({ spellcheck }));
  }, []);

  const handleGrammarChecksPref = useCallback((grammarChecks: boolean) => {
    setWritingAssistancePrefs(writeWritingAssistancePrefs({ grammarChecks }));
  }, []);
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

  /** Bottom bar: snap both rails to the same state — both on unless both already on, then both off. */
  const toggleBothSidebars = useCallback(() => {
    if (isWorkspaceSidebarOpen && readabilityPanelOpen) {
      setIsWorkspaceSidebarOpen(false);
      setReadabilityPanelOpen(false);
    } else {
      setIsWorkspaceSidebarOpen(true);
      setReadabilityPanelOpen(true);
    }
  }, [isWorkspaceSidebarOpen, readabilityPanelOpen]);

  useEffect(() => {
    if (!bothSidebarsClosed) {
      setIsTopChromeHidden(false);
    }
  }, [bothSidebarsClosed]);

  useEffect(() => {
    if (!bothSidebarsClosed) return;
    const onPointerMove = () => {
      setIsTopChromeHidden(false);
    };
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    return () => window.removeEventListener("mousemove", onPointerMove);
  }, [bothSidebarsClosed]);

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
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

  useEffect(() => {
    writeStoredThemeMode(themeMode);
  }, [themeMode]);

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

  useEffect(() => {
    if (!supportedTree?.path) {
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
          path: supportedTree.path,
        });
        if (!cancelled) setWorkspaceVolumeLabel(name.trim() || null);
      } catch {
        if (!cancelled) setWorkspaceVolumeLabel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supportedTree?.path]);

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

  const breadcrumbVolumeFirst = workspaceVolumeLabel?.trim() || "Files";
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
      return activeDocument.content !== activeDocument.lastSavedContent;
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

  const editorEditable = Boolean(activeDocument) || openTabIds.length === 0;

  const stats = useMemo(() => {
    const text = documentTextForStats(scratchEditorBody);
    const sentenceComplexity = tiptapEditor
      ? countSentenceComplexityInDoc(tiptapEditor.state.doc)
      : countSentenceComplexityFromStoredDocument(scratchEditorBody, activeDocument?.sourcePath ?? null);
    return calculateEditorStats(text, sentenceComplexity);
  }, [scratchEditorBody, tiptapEditor, activeDocument?.sourcePath]);

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
      const m = slice.trim().match(/\b[\w'-]+\b/g);
      setSelectedWordCount(m ? m.length : 0);
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

  const openSaveAsModal = useCallback(() => {
    if (!isTauriRuntime()) {
      window.alert("Save As is only available in the Harvy desktop app.");
      return;
    }
    if (!hasWorkspaceFolder) {
      window.alert("Choose a workspace folder before saving files.");
      return;
    }
    if (!editorEditable) return;
    const title = activeDocument?.title ?? (openTabIds.length === 0 ? scratchDocumentTitle : "Untitled");
    setSaveAsInitialFileName(defaultSaveFileName(title));
    setSaveAsDestinationPath(workspaceBrowsePath ?? supportedTree?.path ?? null);
    setSaveAsModalOpen(true);
  }, [
    editorEditable,
    activeDocument,
    openTabIds.length,
    scratchDocumentTitle,
    workspaceBrowsePath,
    supportedTree?.path,
    hasWorkspaceFolder,
  ]);

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
      if (!saveAsDestinationPath) {
        window.alert("Choose a destination folder.");
        return;
      }
      if (workspaceRootPath && !isPathUnderWorkspaceRoot(workspaceRootPath, saveAsDestinationPath)) {
        window.alert("Choose a destination inside your workspace folder.");
        return;
      }
      const trimmed = fileName.trim();
      if (!trimmed) {
        window.alert("Enter a file name.");
        return;
      }

      const normalizedFull = normalizeMarkdownSavePath(joinPath(saveAsDestinationPath, trimmed));
      const leaf = fileNameFromPath(normalizedFull);
      const { base } = splitFileBaseAndExtension(leaf);
      const nameErr = validateFolderName(base);
      if (nameErr) {
        window.alert(nameErr);
        return;
      }

      const markdown = getDocumentMarkdown(tiptapEditor, activeDocument?.content ?? scratchDraftContent);
      setSaveAsSubmitting(true);
      try {
        let outPath: string;
        if (organize === "file") {
          outPath = normalizedFull;
          await invoke("write_text_file", { path: outPath, contents: markdown });
        } else {
          const pkgDir = await invoke<string>("create_unique_directory", {
            parentPath: saveAsDestinationPath,
            baseName: base,
          });
          outPath = normalizeMarkdownSavePath(joinPath(pkgDir, leaf));
          await invoke("write_text_file", { path: outPath, contents: markdown });
        }
        finalizeSavedPath(outPath, markdown);
        await reloadWorkspaceTree();
        setSaveAsModalOpen(false);
      } catch (e) {
        window.alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setSaveAsSubmitting(false);
      }
    },
    [
      saveAsDestinationPath,
      workspaceRootPath,
      tiptapEditor,
      activeDocument,
      scratchDraftContent,
      finalizeSavedPath,
      reloadWorkspaceTree,
    ],
  );

  const saveAsDestinationDisplay = saveAsDestinationPath
    ? fileNameFromPath(saveAsDestinationPath)
    : "Choose folder…";

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
        const markdown = getDocumentMarkdown(tiptapEditor, activeDocument.content);
        await invoke("write_text_file", { path, contents: markdown });
        setOpenDocuments((prev) => ({
          ...prev,
          [activeTabId]: {
            ...prev[activeTabId]!,
            content: markdown,
            lastSavedContent: markdown,
          },
        }));
        return;
      }
      if (openTabIds.length === 0) {
        if (scratchDiskPath) {
          const markdown = getDocumentMarkdown(tiptapEditor, scratchDraftContent);
          await invoke("write_text_file", { path: scratchDiskPath, contents: markdown });
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
    scratchDiskPath,
    scratchDraftContent,
    tiptapEditor,
    editorEditable,
    hasWorkspaceFolder,
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
      saveAsFile: () => void openSaveAsModal(),
      saveAsFolder: () => void openSaveAsModal(),
      exportPdf: () => void performExportPdf(),
      newMarkdownFile: () => void handleCreateMarkdownFileRef.current(),
    });
  }, [performSave, openSaveAsModal, performExportPdf]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    void setupNativeAppMenu().catch((err) => console.error("Native app menu:", err));
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    void (async () => {
      unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
        if (!isDirty) return;
        const ok = await confirm("Discard unsaved changes and close the window?", {
          title: "Harvy",
          kind: "warning",
        });
        if (!ok) event.preventDefault();
      });
    })();
    return () => {
      unlisten?.();
    };
  }, [isDirty]);

  useEffect(() => {
    if (isTauriRuntime()) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("[data-floating-text-menu]")) return;
      if (el?.closest("input, textarea") && !el.closest("#harvy-editor")) return;
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
    if (doc && doc.content !== doc.lastSavedContent) {
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
        content = ingestTextFileContent(raw, node.path);
        kind = "text";
      } catch (error) {
        content =
          "Could not read this file.\n\n" +
          (error instanceof Error ? error.message : String(error));
        kind = "placeholder";
      }
    }

    const nextDoc: WorkspaceDocument = {
      id,
      title: node.name,
      content,
      sourcePath: node.path,
      kind,
      lastSavedContent: content,
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
  const editorTitleBase = splitFileBaseAndExtension(editorTitle).base || "Untitled";
  /** Inline rename for an open file tab, or for the scratch buffer when no tabs are open. */
  const titleRenameEnabled =
    Boolean(activeTabId && activeDocument) || openTabIds.length === 0;

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
  }, [showReadabilityHighlights, tiptapEditor]);

  useEffect(() => {
    if (!tiptapEditor) return;
    setMechanicsUnderlinesVisible(tiptapEditor.view, showMechanicsUnderlines);
  }, [showMechanicsUnderlines, tiptapEditor]);

  /** Live rule-based mechanics (Spelling / Grammar / Suggestions) — runs in Edit mode regardless of sidebar. */
  useEffect(() => {
    if (!tiptapEditor || mode !== "edit" || !editorEditable) {
      return;
    }

    const runSync = () => {
      syncMechanicsProofread(tiptapEditor, setProofreadIssues);
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
  }, [tiptapEditor, mode, editorEditable]);
  /** TipTap Placeholder extension only renders when the doc is empty; no real document text. */
  const editorPlaceholder = editorEditable ? "Start writing..." : undefined;
  const editorInstanceKey = activeTabId ?? (openTabIds.length === 0 ? "scratch" : "browse");

  const copyDocumentFallbackMarkdown = useMemo(
    () => activeDocument?.content ?? (openTabIds.length === 0 ? scratchDraftContent : ""),
    [activeDocument?.content, openTabIds.length, scratchDraftContent],
  );

  const handleCopyDocument = useCallback(async () => {
    return copyDocumentToClipboard(tiptapEditor, copyDocumentFallbackMarkdown, workspaceRootPath);
  }, [tiptapEditor, copyDocumentFallbackMarkdown, workspaceRootPath]);

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

  async function handleAiProofread() {
    if (!tiptapEditor || !editorEditable || mode !== "edit") return;
    const snapshot = proofreadPlainTextAndPositions(tiptapEditor.state.doc);
    if (!snapshot.text.trim()) {
      window.alert("Nothing to proofread.");
      return;
    }
    setProofreadBusy(true);
    try {
      syncMechanicsProofread(tiptapEditor, setProofreadIssues);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Proofread failed";
      window.alert(msg);
    } finally {
      setProofreadBusy(false);
    }
  }

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
      if (nextBase === displayBase) return true;

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
          if (!d || d.title === newTitle) return prev;
          return { ...prev, [id]: { ...d, title: newTitle } };
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

  const readabilitySidebarPanel = (
    <SidebarRight
      stats={stats}
      mode={mode}
      onModeChange={handleSidebarModeChange}
      selectedWordCount={selectedWordCount}
      editor={tiptapEditor}
      createOutlineMode={createOutlineMode}
      onCreateOutlineModeChange={setCreateOutlineMode}
      outlineInstructionsVisible={outlineInstructionsVisible}
      onOutlineInstructionsVisibleChange={setOutlineInstructionsVisible}
      onAiProofread={handleAiProofread}
      proofreadBusy={proofreadBusy}
      proofreadIssues={proofreadIssues}
    />
  );

  const tabBarRow = (
    <div
      className={`h-8 overflow-hidden transition-[background-color,border-color,box-shadow] duration-500 ease-in-out ${
        isTopChromeHidden ? "border-transparent bg-stage shadow-none" : "bg-mist"
      }`}
    >
      <div
        className={`transition-[opacity,transform] duration-500 ease-in-out ${
          isTopChromeHidden ? "pointer-events-none -translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <OpenWindowsBar
          tabs={openTabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTab}
          onCloseTab={closeTab}
          onCreateTab={createUntitledTab}
          chromeHidden={isTopChromeHidden}
          workspaceSidebarOpen={isWorkspaceSidebarOpen}
          overlayWorkspaceRail={sidebarOverlayLayout}
          reserveWorkspaceToggleSlot={!isWorkspaceSidebarOpen}
        />
      </div>
    </div>
  );

  const documentHeaderRow = (
    <div
      className={`h-[2.125rem] overflow-hidden transition-[background-color,border-color,box-shadow] duration-500 ease-in-out ${
        isTopChromeHidden ? "border-transparent bg-stage shadow-none" : "bg-mist/25"
      }`}
    >
      <div
        className={`transition-[opacity,transform] duration-500 ease-in-out ${
          isTopChromeHidden ? "pointer-events-none -translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <EditorDocumentHeader
          documentTitleBase={editorTitleBase}
          documentDirty={isDirty}
          workspaceSidebarOpen={isWorkspaceSidebarOpen}
          overlayWorkspaceRail={sidebarOverlayLayout}
          reserveWorkspaceToggleSlot={!isWorkspaceSidebarOpen}
          readabilityPanelOpen={readabilityPanelOpen}
          chromeButtonsHidden={isTopChromeHidden}
          onToggleReadabilityPanel={() => setReadabilityPanelOpen((v) => !v)}
          titleRenameEnabled={titleRenameEnabled}
          onCommitDocumentTitle={commitActiveDocumentTitleRename}
        />
      </div>
    </div>
  );

  const editorPanelSection = (
    <section
      className="mx-auto flex min-h-0 w-full max-w-[820px] flex-1 flex-col overflow-hidden bg-stage"
      aria-label="Editor"
      role="tabpanel"
      id="harvy-editor-panel"
      aria-labelledby={activeTabId ? `harvy-tab-${activeTabId}` : undefined}
    >
      {SHOW_FORMATTING_TOOLBAR ? <EditorToolbar mode={mode} onRunCommand={runToolbarCommand} /> : null}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <EditorCanvas
          key={editorInstanceKey}
          mode={mode}
          documentTitle={editorTitle}
          text={editorText}
          contentSourcePath={activeDocument?.sourcePath ?? null}
          placeholder={editorPlaceholder}
          isEditable={editorEditable}
          spellcheckEnabled={showEditModeSpellcheck}
          grammarChecksEnabled={
            writingAssistancePrefs.grammarChecks && readabilityPanelOpen && mode === "edit"
          }
          showReadabilityHighlights={showReadabilityHighlights}
          showMechanicsUnderlines={showMechanicsUnderlines}
          showOutlineInstructions={!createOutlineMode || outlineInstructionsVisible}
          createOutlineMode={createOutlineMode}
          workspaceRootPath={workspaceRootPath}
          pickLocalImage={pickLocalImage}
          loadImageAt={loadImageAtPos}
          onInsertImage={editorEditable ? () => void handleInsertImage() : undefined}
          onChangeText={updateActiveDocumentContent}
          onEditorReady={handleEditorReady}
          onTypingActivity={emitEditorTypingActivity}
        />
        <FloatingTextMenu
          editor={tiptapEditor}
          isEditable={editorEditable}
          onApplyFormat={runEditorFormatCommand}
        />
        <EditorAmbientControls
          activityHandlerRef={editorTypingActivityHandlerRef}
          onToggleBothSidebars={toggleBothSidebars}
          onCopyDocument={handleCopyDocument}
          syncWithChrome
          chromeHidden={isTopChromeHidden}
        />
      </div>
    </section>
  );

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-canvas">
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
                  readabilityPanelOpen ? "w-[300px]" : "pointer-events-none w-0"
                }`}
              >
                <div
                  className={`flex h-full min-h-0 w-[300px] shrink-0 flex-col transition-opacity duration-500 ease-in-out ${
                    readabilityPanelOpen ? "opacity-100 delay-0" : "opacity-0 delay-0"
                  }`}
                >
                  {readabilitySidebarPanel}
                </div>
              </div>
            </div>
          </div>
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
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
            {tabBarRow}
            <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden bg-stage">
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {documentHeaderRow}
                {editorPanelSection}
              </div>
              <div
                aria-hidden={!readabilityPanelOpen}
                className={`flex shrink-0 flex-col overflow-hidden bg-stage transition-[width] duration-500 ease-in-out [backdrop-filter:none] ${
                  readabilityPanelOpen ? "w-[300px]" : "pointer-events-none w-0"
                }`}
              >
                <div
                  className={`flex h-full min-h-0 w-[300px] shrink-0 flex-col transition-opacity duration-500 ease-in-out ${
                    readabilityPanelOpen ? "opacity-100 delay-0" : "opacity-0 delay-0"
                  }`}
                >
                  {readabilitySidebarPanel}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Same vertical band as OpenWindowsBar (h-8); flex centers the h-8 control like the tab row */}
      <div
        className={`pointer-events-none absolute left-2 top-0 z-30 flex h-8 items-center rounded-md px-0.5 transition-[opacity,background-color] duration-500 ease-in-out ${
          isTopChromeHidden ? "bg-stage opacity-0" : "bg-mist/55 opacity-100"
        }`}
      >
        <ChromeSidebarToggleButton
          icon={PanelLeft}
          open={isWorkspaceSidebarOpen}
          onClick={() => setIsWorkspaceSidebarOpen((v) => !v)}
          ariaLabelOpen="Hide sidebar"
          ariaLabelClosed="Show sidebar"
        />
      </div>

      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        readabilityPanelOpen={readabilityPanelOpen}
        onReadabilityPanelChange={setReadabilityPanelOpen}
        spellcheckEnabled={writingAssistancePrefs.spellcheck}
        grammarChecksEnabled={writingAssistancePrefs.grammarChecks}
        onSpellcheckChange={handleSpellcheckPref}
        onGrammarChecksChange={handleGrammarChecksPref}
        workspaceRootPath={workspaceRootPath}
        onChooseWorkspaceFolder={chooseWorkspaceFolder}
      />
      <SaveAsModal
        open={saveAsModalOpen}
        onClose={() => {
          if (saveAsSubmitting) return;
          setSaveAsModalOpen(false);
        }}
        initialFileName={saveAsInitialFileName}
        destinationPath={saveAsDestinationPath}
        destinationDisplay={saveAsDestinationDisplay}
        isSubmitting={saveAsSubmitting}
        onPickDestination={pickSaveAsDestination}
        onSave={(payload) => void commitSaveAsFromModal(payload)}
      />
      <AboutModal open={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}
