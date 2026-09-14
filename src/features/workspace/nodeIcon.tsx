import type { LucideIcon } from "lucide-react";
import { ChevronRight, File, FileImage, FilePenLine, FileText, FileType, Folder } from "lucide-react";
import type { FileNode } from "./types";
import { IMAGE_EXTENSIONS } from "./tree";

/** Last segment after "." — case-insensitive; supports names like `notes.v1.txt`. */
function fileExtension(name: string): string | null {
  const i = name.lastIndexOf(".");
  if (i <= 0 || i === name.length - 1) return null;
  return name.slice(i + 1).toLowerCase();
}

/**
 * Picks a Lucide icon for a workspace tree node.
 * Directories always use the closed folder; files map by extension.
 */
export function getNodeIcon(node: FileNode): LucideIcon {
  if (node.kind === "directory") {
    return Folder;
  }

  const ext = fileExtension(node.name);
  if (ext && IMAGE_EXTENSIONS.includes(ext as (typeof IMAGE_EXTENSIONS)[number])) {
    return FileImage;
  }
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

/** Finder-style disclosure triangle — sits to the left of the folder icon. */
export function WorkspaceFolderChevron({ expanded }: { expanded: boolean }) {
  return (
    <ChevronRight
      size={12}
      strokeWidth={2.25}
      aria-hidden
      className={`shrink-0 text-muted/55 transition-transform duration-200 ease-out ${
        expanded ? "rotate-90" : "rotate-0"
      }`}
    />
  );
}

export function WorkspaceNodeIcon({ node }: { node: FileNode }) {
  const Icon = getNodeIcon(node);
  return <Icon {...WORKSPACE_ICON_PROPS} />;
}
