import type { Editor } from "@tiptap/core";
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

export type ProjectStructureInput = {
  notes: string;
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
    exportFolders: [],
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
