/** Stable key for persisting generated format outputs per document. */
export function formatDocumentKey(
  activeTabId: string | null,
  openTabCount: number,
): string {
  if (activeTabId?.trim()) return activeTabId.trim();
  if (openTabCount === 0) return "scratch";
  return "browse";
}
