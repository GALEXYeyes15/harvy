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
  /** In-document headline (Substack-style Title) — not the file/tab name. */
  postTitle: string;
  lastSavedPostTitle: string;
  /** In-document dek (Substack-style Subtitle). */
  subtitle: string;
  lastSavedSubtitle: string;
  /** Sidebar scratchpad notes for this document (persisted under `Notes/` in project folders). */
  notes: string;
  lastSavedNotes: string;
  /** Writing criteria for this document (persisted under `Notes/` in project folders). */
  criteria: string;
  lastSavedCriteria: string;
  /** Notion database page this essay is linked to (survives save/rename). */
  notionParentPageId: string;
  /** Nested Notion page that holds the synced essay body. */
  notionEssayPageId: string;
  /** When true, Harvy created the parent database row and may rename it. */
  notionRenameParent: boolean;
  /** Notion URL for the parent Ideas row. */
  notionParentUrl: string;
  /** Notion URL for the nested essay page. */
  notionEssayUrl: string;
  /** Public published URL (Substack / site) when matched. */
  publicUrl: string;
};

export const EMPTY_NOTION_ESSAY_FIELDS = {
  notionParentPageId: "",
  notionEssayPageId: "",
  notionRenameParent: false,
  notionParentUrl: "",
  notionEssayUrl: "",
  publicUrl: "",
} as const;
