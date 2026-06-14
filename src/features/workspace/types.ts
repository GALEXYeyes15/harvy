import type { FormatCategoryAmounts, FormatCategorySelection } from "../format/formatCategories";

export type FileNode = {
  name: string;
  path: string;
  kind: "file" | "directory";
  children?: FileNode[];
};

export type WorkspaceDocument = {
  id: string;
  title: string;
  content: string;
  /** Filesystem path when the tab is backed by a real file (same as `id` for opened files). */
  sourcePath: string;
  kind: "text" | "placeholder";
  /** Markdown (or legacy HTML) last successfully written to disk for this tab (`sourcePath`). */
  lastSavedContent: string;
  /** Sidebar scratchpad notes for this document (persisted under `Notes/` in project folders). */
  notes: string;
  lastSavedNotes: string;
  formatCategorySelection?: FormatCategorySelection;
  formatCategoryAmounts?: FormatCategoryAmounts;
  /** @deprecated Migrated to formatCategorySelection on read. */
  formatPlatformSelection?: Partial<Record<string, boolean>>;
  /** @deprecated Migrated to formatCategoryAmounts on read. */
  formatPlatformAmounts?: Partial<Record<string, number>>;
};
