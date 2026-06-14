import type { Editor } from "@tiptap/core";
import type { FormatCategoryId } from "../format/formatCategories";
import type { GeneratedTwitterCollection } from "../format/formatGeneratedOutputs";
import type {
  FormatCategoryGenerationResult,
  FormatGenerationOrchestratorResult,
} from "../format/generation/orchestratorTypes";
import { isFormatCategorySuccess } from "../format/generation/orchestratorResults";
import { projectNotesFileName } from "../workspace/documentNotes";

export type ProjectExportFolder = {
  folderName: string;
  files: string[];
};

export type ProjectStructure = {
  hasNotes: boolean;
  hasImages: boolean;
  exportFolders: ProjectExportFolder[];
};

/** @deprecated Use ProjectStructure */
export type SaveAsFolderPreviewContext = ProjectStructure;

/** @deprecated Use ProjectExportFolder */
export type SaveAsExistingExport = {
  folderName: string;
  fileName?: string;
};

export type ProjectStructureInput = {
  notes: string;
  editor: Editor | null;
  documentMarkdown: string;
  formatResults: FormatGenerationOrchestratorResult | null;
  twitterCollection: GeneratedTwitterCollection | null;
};

export type SaveAsFolderPreviewNode = {
  name: string;
  children?: SaveAsFolderPreviewNode[];
};

type ExportCategoryConfig = {
  folderName: string;
  filePrefix: string;
};

const EXPORT_CATEGORY_CONFIG: Record<
  Exclude<FormatCategoryId, "tweets_notes">,
  ExportCategoryConfig
> = {
  newsletter: { folderName: "Newsletters", filePrefix: "Newsletter" },
  podcast_notes: { folderName: "Podcasts", filePrefix: "Podcast" },
  short_form_outline: { folderName: "Short Form", filePrefix: "Short Form" },
  long_form_outline: { folderName: "Long Form", filePrefix: "Long Form" },
};

const EXPORT_CATEGORY_ORDER: Exclude<FormatCategoryId, "tweets_notes">[] = [
  "newsletter",
  "podcast_notes",
  "short_form_outline",
  "long_form_outline",
];

function orchestratorOutputContents(
  result: FormatCategoryGenerationResult | undefined,
): string[] {
  if (!isFormatCategorySuccess(result)) return [];
  return result.outputs.map((output) => output.content.trim()).filter(Boolean);
}

function tweetOutputContents(twitterCollection: GeneratedTwitterCollection | null): string[] {
  return (
    twitterCollection?.tweets.map((tweet) => tweet.text.trim()).filter(Boolean) ?? []
  );
}

function categoryOutputContents(
  categoryId: FormatCategoryId,
  input: ProjectStructureInput,
): string[] {
  if (categoryId === "tweets_notes") {
    const fromCollection = tweetOutputContents(input.twitterCollection);
    if (fromCollection.length > 0) return fromCollection;
    return orchestratorOutputContents(input.formatResults?.tweets_notes);
  }

  return orchestratorOutputContents(input.formatResults?.[categoryId]);
}

function buildExportFolders(input: ProjectStructureInput): ProjectExportFolder[] {
  const folders: ProjectExportFolder[] = [];

  const tweetContents = categoryOutputContents("tweets_notes", input);
  if (tweetContents.length > 0) {
    folders.push({ folderName: "Tweets", files: ["Tweets Table.md"] });
  }

  for (const categoryId of EXPORT_CATEGORY_ORDER) {
    const contents = categoryOutputContents(categoryId, input);
    if (contents.length === 0) continue;

    const config = EXPORT_CATEGORY_CONFIG[categoryId];
    folders.push({
      folderName: config.folderName,
      files: contents.map((_, index) => `${config.filePrefix} ${index + 1}.md`),
    });
  }

  return folders;
}

export function hasSaveAsNotesContent(notes: string): boolean {
  return Boolean(notes.trim());
}

export function documentHasEmbeddedImages(
  editor: Editor | null,
  fallbackMarkdown: string,
): boolean {
  if (editor) {
    let found = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name !== "harvyImage") return;
      const status = node.attrs.status;
      const src = node.attrs.src;
      if (status === "loaded" && typeof src === "string" && src.trim()) {
        found = true;
        return false;
      }
    });
    if (found) return true;
  }

  return (
    /data-harvy-image-status=["']loaded["']/i.test(fallbackMarkdown) ||
    /\.harvy\/assets\//i.test(fallbackMarkdown)
  );
}

/** Shared source of truth for Save As folder preview and folder creation. */
export function getProjectStructure(input: ProjectStructureInput): ProjectStructure {
  return {
    hasNotes: hasSaveAsNotesContent(input.notes),
    hasImages: documentHasEmbeddedImages(input.editor, input.documentMarkdown),
    exportFolders: buildExportFolders(input),
  };
}

export function buildSaveAsFolderPreviewContext(input: ProjectStructureInput): ProjectStructure {
  return getProjectStructure(input);
}

/** Relative subfolder paths to create inside a project folder (directories only). */
export function projectSubfolderPathsToCreate(structure: ProjectStructure): string[] {
  const paths: string[] = ["Drafts"];
  if (structure.hasNotes) paths.push("Notes");
  if (structure.hasImages) paths.push("Images");
  if (structure.exportFolders.length > 0) {
    paths.push("Exports");
    for (const exp of structure.exportFolders) {
      paths.push(`Exports/${exp.folderName}`);
    }
  }
  return paths;
}

export function buildSaveAsFolderPreviewRoot(
  folderBase: string,
  leafFileName: string,
  structure: ProjectStructure,
): SaveAsFolderPreviewNode {
  const children: SaveAsFolderPreviewNode[] = [{ name: leafFileName }, { name: "Drafts" }];

  if (structure.hasNotes) {
    children.push({
      name: "Notes",
      children: [{ name: projectNotesFileName(leafFileName) }],
    });
  }

  if (structure.hasImages) {
    children.push({ name: "Images" });
  }

  const exportChildren: SaveAsFolderPreviewNode[] = structure.exportFolders.map((exp) => ({
    name: exp.folderName,
    children: exp.files.map((fileName) => ({ name: fileName })),
  }));

  if (exportChildren.length > 0) {
    children.push({
      name: "Exports",
      children: exportChildren,
    });
  }

  return {
    name: folderBase,
    children,
  };
}

export function renderSaveAsFolderPreviewLines(root: SaveAsFolderPreviewNode): string[] {
  const lines = [`📁 ${root.name}`];
  if (root.children?.length) {
    lines.push(...renderChildPreviewLines(root.children, ""));
  }
  return lines;
}

function renderChildPreviewLines(nodes: SaveAsFolderPreviewNode[], parentPrefix: string): string[] {
  const lines: string[] = [];
  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1;
    const branch = isLast ? "└── " : "├── ";
    lines.push(`${parentPrefix}${branch}${node.name}`);
    if (node.children?.length) {
      const childPrefix = parentPrefix + (isLast ? "    " : "│   ");
      lines.push(...renderChildPreviewLines(node.children, childPrefix));
    }
  });
  return lines;
}

/** @deprecated Use getProjectStructure */
export function existingExportsForSaveAsPreview(
  results: FormatGenerationOrchestratorResult | null,
  twitterCollection: GeneratedTwitterCollection | null,
): SaveAsExistingExport[] {
  const structure = getProjectStructure({
    notes: "",
    editor: null,
    documentMarkdown: "",
    formatResults: results,
    twitterCollection,
  });
  return structure.exportFolders.map((folder) => ({
    folderName: folder.folderName,
    fileName: folder.files[0],
  }));
}
