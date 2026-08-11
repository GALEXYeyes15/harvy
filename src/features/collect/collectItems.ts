export type CollectItem = {
  id: string;
  /** Essay title (Notion Name / title property). */
  preview: string;
  dateCreated: string;
  /** Longer notes (e.g. from Notion). */
  body?: string;
  /** Notion page id when synced from the Ideas database. */
  notionPageId?: string;
  /** Notion Status value when synced (e.g. "Idea"). */
  status?: string;
};

export function formatCollectDateCreated(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function todayCollectDateCreated(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createCollectItem(): CollectItem {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `collect-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    id,
    preview: "",
    dateCreated: todayCollectDateCreated(),
  };
}

function parseCollectItemRecord(value: unknown): CollectItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.preview !== "string") return null;
  if (typeof record.dateCreated !== "string") return null;

  return normalizeCollectItem({
    id: record.id,
    preview: record.preview,
    dateCreated: record.dateCreated,
    body: typeof record.body === "string" ? record.body : undefined,
    notionPageId:
      typeof record.notionPageId === "string" && record.notionPageId.trim()
        ? record.notionPageId.trim()
        : undefined,
    status:
      typeof record.status === "string" && record.status.trim()
        ? record.status.trim()
        : undefined,
  });
}

export function normalizeCollectItem(item: CollectItem): CollectItem {
  return {
    id: item.id,
    preview: item.preview,
    dateCreated: item.dateCreated || todayCollectDateCreated(),
    body: typeof item.body === "string" ? item.body : undefined,
    notionPageId:
      typeof item.notionPageId === "string" && item.notionPageId.trim()
        ? item.notionPageId.trim()
        : undefined,
    status:
      typeof item.status === "string" && item.status.trim()
        ? item.status.trim()
        : undefined,
  };
}

export function parsePersistedCollectItems(raw: unknown): CollectItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parseCollectItemRecord)
    .filter((item): item is CollectItem => item !== null);
}
