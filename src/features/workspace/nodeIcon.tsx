import type { LucideIcon } from "lucide-react";
import { File, FilePenLine, FileText, FileType, Folder, FolderOpen } from "lucide-react";
import type { FileNode } from "./types";

/** Last segment after "." — case-insensitive; supports names like `notes.v1.txt`. */
function fileExtension(name: string): string | null {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return null;
  return name.slice(i + 1).toLowerCase();
}

/**
 * Picks a Lucide icon for a workspace tree node.
 * Directories use open/closed folder icons; files map by extension.
 */
export function getNodeIcon(node: FileNode, isExpanded?: boolean): LucideIcon {
  if (node.kind === "directory") {
    return isExpanded ? FolderOpen : Folder;
  }

  const ext = fileExtension(node.name);
  switch (ext) {
    case "pdf":
      return FileType;
    case "txt":
      return FileText;
    case "md":
    case "markdown":
    case "mkd":
      return FilePenLine;
    case "harvy":
      return File;
    default:
      return File;
  }
}

/** Shared sizing so rows stay aligned with 12px label text. */
export const WORKSPACE_ICON_PROPS = {
  size: 13,
  strokeWidth: 1.5,
  className: "shrink-0 text-muted/75",
  "aria-hidden": true as const,
};

export function WorkspaceNodeIcon({
  node,
  isExpanded,
  selected,
}: {
  node: FileNode;
  isExpanded: boolean;
  selected: boolean;
}) {
  const Icon = getNodeIcon(node, node.kind === "directory" ? isExpanded : undefined);
  return (
    <Icon
      {...WORKSPACE_ICON_PROPS}
      className={
        selected ? `${WORKSPACE_ICON_PROPS.className} text-muted` : WORKSPACE_ICON_PROPS.className
      }
    />
  );
}
