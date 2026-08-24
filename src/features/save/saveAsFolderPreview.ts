import type { Editor } from "@tiptap/core";
import { projectCriteriaFileName } from "../workspace/documentCriteria";
import { projectNotesFileName } from "../workspace/documentNotes";
import { collectEmbeddedImageSrcs, packagedImageFileName } from "./documentImages";

export type ProjectExportFolder = {
  folderName: string;
  files: string[];
};

export type ProjectStructure = {
  hasNotes: boolean;
  hasCriteria: boolean;
  hasImages: boolean;
  /** Suggested image filenames for folder preview (best-effort). */
  imageFileNames: string[];
  exportFolders: ProjectExportFolder[];
};

/** @deprecated Use ProjectStructure */
export type SaveAsFolderPreviewContext = ProjectStructure;

export type ProjectStructureInput = {
  notes: string;
  criteria: string;
  editor: Editor | null;
  documentMarkdown: string;
};

export type SaveAsFolderPreviewNode = {
  name: string;
  children?: SaveAsFolderPreviewNode[];
};

export function hasSaveAsNotesContent(notes: string): boolean {
  return Boolean(notes.trim());
}

export function hasSaveAsCriteriaContent(criteria: string): boolean {
  return Boolean(criteria.trim());
}

export function documentHasEmbeddedImages(
  editor: Editor | null,
  fallbackMarkdown: string,
): boolean {
  return collectEmbeddedImageSrcs(editor, fallbackMarkdown).length > 0;
}

/** Shared source of truth for Save As folder preview and folder creation. */
export function getProjectStructure(input: ProjectStructureInput): ProjectStructure {
  const imageSrcs = collectEmbeddedImageSrcs(input.editor, input.documentMarkdown);
  return {
    hasNotes: hasSaveAsNotesContent(input.notes),
    hasCriteria: hasSaveAsCriteriaContent(input.criteria),
    hasImages: imageSrcs.length > 0,
    imageFileNames: imageSrcs.map((ref, i) => packagedImageFileName(ref, i + 1)),
    exportFolders: [],
  };
}

export function buildSaveAsFolderPreviewContext(input: ProjectStructureInput): ProjectStructure {
  return getProjectStructure(input);
}

/** Relative subfolder paths to create inside a project folder (directories only). */
export function projectSubfolderPathsToCreate(structure: ProjectStructure): string[] {
  const paths: string[] = ["Exports"];
  if (structure.hasNotes || structure.hasCriteria) paths.push("Notes");
  if (structure.hasImages) paths.push("Images");
  return paths;
}

export function buildSaveAsFolderPreviewRoot(
  folderBase: string,
  leafFileName: string,
  structure: ProjectStructure,
): SaveAsFolderPreviewNode {
  const children: SaveAsFolderPreviewNode[] = [{ name: leafFileName }];

  const exportEntry = structure.exportFolders.find((folder) => folder.folderName === "Exports");
  const exportFiles = exportEntry?.files ?? [];
  children.push({
    name: "Exports",
    children: exportFiles.length > 0 ? exportFiles.map((name) => ({ name })) : undefined,
  });

  if (structure.hasNotes || structure.hasCriteria) {
    const noteFiles: string[] = [];
    if (structure.hasNotes) noteFiles.push(projectNotesFileName(leafFileName));
    if (structure.hasCriteria) noteFiles.push(projectCriteriaFileName(leafFileName));
    children.push({
      name: "Notes",
      children: noteFiles.map((name) => ({ name })),
    });
  }

  if (structure.hasImages) {
    children.push({
      name: "Images",
      children: structure.imageFileNames.map((name) => ({ name })),
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
