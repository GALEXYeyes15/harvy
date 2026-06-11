export type CollectItem = {
  id: string;
  preview: string;
  type: string;
  dateCreated: string;
  body?: string;
};

export const COLLECT_TYPE_OPTIONS = [
  "Note",
  "Article",
  "Tweet",
  "Video",
  "Quote",
  "Thread",
] as const;

export function collectItemTypeLabel(type: string): string {
  const trimmed = type.trim();
  return trimmed || "Note";
}

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
    type: "Note",
    dateCreated: todayCollectDateCreated(),
  };
}

function isCollectItem(value: unknown): value is CollectItem {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.preview === "string" &&
    typeof record.type === "string" &&
    typeof record.dateCreated === "string"
  );
}

export function normalizeCollectItem(item: CollectItem): CollectItem {
  return {
    id: item.id,
    preview: item.preview,
    type: item.type.trim() || "Note",
    dateCreated: item.dateCreated || todayCollectDateCreated(),
    body: typeof item.body === "string" ? item.body : undefined,
  };
}

export function parsePersistedCollectItems(raw: unknown): CollectItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isCollectItem).map(normalizeCollectItem);
}
