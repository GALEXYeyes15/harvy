export type CollectItemType = "Idea" | "Craft";

export type CollectItem = {
  id: string;
  preview: string;
  format: string;
  type: CollectItemType;
  dateCreated: string;
  body?: string;
};

export const COLLECT_FORMAT_OPTIONS = [
  "Note",
  "Article",
  "Tweet",
  "Video",
  "Quote",
  "Thread",
] as const;

export const COLLECT_TYPE_OPTIONS: CollectItemType[] = ["Idea", "Craft"];

export function collectItemFormatLabel(format: string): string {
  const trimmed = format.trim();
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

function isCollectItemType(value: string): value is CollectItemType {
  return value === "Idea" || value === "Craft";
}

function readCollectItemFormat(record: Record<string, unknown>): string {
  if (typeof record.format === "string") return record.format;
  if (typeof record.type === "string" && !isCollectItemType(record.type)) return record.type;
  return "Note";
}

function readCollectItemType(record: Record<string, unknown>): CollectItemType {
  if (typeof record.type === "string" && isCollectItemType(record.type)) return record.type;
  return "Idea";
}

export function createCollectItem(): CollectItem {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `collect-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  return {
    id,
    preview: "",
    format: "Note",
    type: "Idea",
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
    format: readCollectItemFormat(record),
    type: readCollectItemType(record),
    dateCreated: record.dateCreated,
    body: typeof record.body === "string" ? record.body : undefined,
  });
}

export function normalizeCollectItem(item: CollectItem): CollectItem {
  return {
    id: item.id,
    preview: item.preview,
    format: item.format.trim() || "Note",
    type: isCollectItemType(item.type) ? item.type : "Idea",
    dateCreated: item.dateCreated || todayCollectDateCreated(),
    body: typeof item.body === "string" ? item.body : undefined,
  };
}

export function parsePersistedCollectItems(raw: unknown): CollectItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parseCollectItemRecord)
    .filter((item): item is CollectItem => item !== null);
}
