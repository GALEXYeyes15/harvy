import type { WorkspaceDocument } from "../workspace/types";

/** One open page tab in the shell chrome (order is defined by `openTabIds` in AppShell). */
export type PageTab = {
  id: string;
  title: string;
  path?: string;
  isDirty: boolean;
};

export function toPageTabs(
  orderedIds: readonly string[],
  documents: Readonly<Record<string, WorkspaceDocument>>,
): PageTab[] {
  const out: PageTab[] = [];
  for (const id of orderedIds) {
    const doc = documents[id];
    if (!doc) continue;
    out.push({
      id: doc.id,
      title: doc.title,
      path: doc.sourcePath,
      isDirty:
        doc.content !== doc.lastSavedContent ||
        doc.notes !== doc.lastSavedNotes ||
        doc.criteria !== doc.lastSavedCriteria ||
        doc.postTitle !== doc.lastSavedPostTitle ||
        doc.subtitle !== doc.lastSavedSubtitle,
    });
  }
  return out;
}

/**
 * After removing `closedId` from the tab strip, choose the next active tab.
 * If the closed tab was not active, keep the current active id.
 * If it was active, prefer the tab to the left; otherwise the new first tab.
 */
export function nextActiveTabIdAfterClose(
  orderedIdsBeforeClose: readonly string[],
  closedId: string,
  activeIdBefore: string | null,
): string | null {
  if (activeIdBefore !== closedId) return activeIdBefore;
  const idx = orderedIdsBeforeClose.indexOf(closedId);
  if (idx === -1) return activeIdBefore;
  const remaining = orderedIdsBeforeClose.filter((id) => id !== closedId);
  if (remaining.length === 0) return null;
  return idx > 0 ? remaining[idx - 1]! : remaining[0]!;
}
