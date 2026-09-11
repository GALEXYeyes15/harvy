import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";
import type { CollectItem } from "../collect/collectItems";
import { createCollectItem, todayCollectDateCreated } from "../collect/collectItems";

export type NotionIdeasConfigPublic = {
  connected: boolean;
  databaseId: string;
  titleProperty: string;
  notesProperty: string;
  statusProperty: string;
  ideaStatusValue: string;
  startedStatusValue: string;
  publishedStatusValue: string;
  urlProperty: string;
  dateProperty: string;
  hasToken: boolean;
};

export type NotionPropertyInfo = {
  name: string;
  propertyType: string;
  options?: string[];
};

function isStatusDropdown(property: NotionPropertyInfo): boolean {
  return property.propertyType === "status" || property.propertyType === "select";
}

/** Infer Title / Notes / Status / URL property names from a Notion database schema. */
export function inferNotionIdeasPropertyMap(schema: NotionPropertyInfo[]): {
  titleProperty: string;
  notesProperty: string;
  statusProperty: string;
  urlProperty: string;
  dateProperty: string;
} {
  const title = schema.find((p) => p.propertyType === "title");
  const status =
    schema.find((p) => isStatusDropdown(p) && /^status$/i.test(p.name)) ??
    schema.find((p) => isStatusDropdown(p) && /^progress$/i.test(p.name)) ??
    schema.find((p) => p.propertyType === "status");
  const notes =
    schema.find(
      (p) =>
        p.propertyType === "rich_text" &&
        /note|body|summary|description|idea/i.test(p.name),
    ) ??
    schema.find((p) => p.propertyType === "rich_text") ??
    null;
  const url =
    schema.find(
      (p) =>
        p.propertyType === "url" &&
        /url|link|published|canonical/i.test(p.name),
    ) ??
    schema.find((p) => p.propertyType === "url") ??
    null;

  const date =
    schema.find(
      (p) =>
        p.propertyType === "date" &&
        /publish(ed)? date|date published|^published$/i.test(p.name),
    ) ??
    schema.find((p) => p.propertyType === "date" && /publish/i.test(p.name)) ??
    schema.find((p) => p.propertyType === "date") ??
    null;

  return {
    titleProperty: title?.name ?? "",
    notesProperty: notes?.name ?? "",
    statusProperty: status?.name ?? "",
    urlProperty: url?.name ?? "",
    dateProperty: date?.name ?? "",
  };
}

export function dateOptionsFromSchema(schema: NotionPropertyInfo[]): string[] {
  return schema
    .filter((p) => p.propertyType === "date")
    .map((p) => p.name.trim())
    .filter(Boolean);
}

export function urlOptionsFromSchema(schema: NotionPropertyInfo[]): string[] {
  return schema
    .filter((p) => p.propertyType === "url")
    .map((p) => p.name.trim())
    .filter(Boolean);
}

export function statusOptionsFromSchema(schema: NotionPropertyInfo[]): string[] {
  const { statusProperty } = inferNotionIdeasPropertyMap(schema);
  if (!statusProperty) return [];
  const prop = schema.find((p) => p.name === statusProperty);
  return (prop?.options ?? []).map((name) => name.trim()).filter(Boolean);
}

export type NotionIdeaPage = {
  pageId: string;
  title: string;
  notes: string;
  status: string;
  createdTime: string;
};

export type NotionSaveConfigInput = {
  token: string;
  databaseIdOrUrl: string;
  titleProperty: string;
  notesProperty: string;
  statusProperty: string;
  ideaStatusValue?: string;
  startedStatusValue?: string;
  publishedStatusValue?: string;
  urlProperty?: string;
  dateProperty?: string;
  keepExistingToken?: boolean;
};

const LAST_SYNCED_KEY = "harvy:notion-ideas-last-synced";
const DISMISSED_KEY = "harvy:notion-ideas-dismissed";

export function readNotionIdeasLastSyncedAt(): number | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(LAST_SYNCED_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function writeNotionIdeasLastSyncedAt(ms: number = Date.now()): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LAST_SYNCED_KEY, String(ms));
}

export function readDismissedNotionIdeaIds(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  } catch {
    return [];
  }
}

export function dismissNotionIdeaPage(pageId: string): void {
  const trimmed = pageId.trim();
  if (!trimmed || typeof localStorage === "undefined") return;
  const next = new Set(readDismissedNotionIdeaIds());
  next.add(trimmed);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
}

function requireTauri(): void {
  if (!isTauriRuntime()) {
    throw new Error("Notion Ideas sync requires the Harvy desktop app.");
  }
}

export async function getNotionIdeasConfig(): Promise<NotionIdeasConfigPublic> {
  requireTauri();
  return invoke<NotionIdeasConfigPublic>("notion_get_ideas_config");
}

export async function saveNotionIdeasConfig(
  input: NotionSaveConfigInput,
): Promise<NotionIdeasConfigPublic> {
  requireTauri();
  return invoke<NotionIdeasConfigPublic>("notion_save_ideas_config", { input });
}

export async function clearNotionIdeasConfig(): Promise<void> {
  requireTauri();
  await invoke("notion_clear_ideas_config");
}

export async function fetchNotionDatabaseSchema(opts?: {
  token?: string;
  databaseIdOrUrl?: string;
}): Promise<NotionPropertyInfo[]> {
  requireTauri();
  return invoke<NotionPropertyInfo[]>("notion_fetch_database_schema", {
    token: opts?.token ?? null,
    databaseIdOrUrl: opts?.databaseIdOrUrl ?? null,
  });
}

export async function queryNotionIdeaPages(): Promise<NotionIdeaPage[]> {
  requireTauri();
  return invoke<NotionIdeaPage[]>("notion_query_idea_pages");
}

export async function markNotionIdeaStarted(pageId: string): Promise<void> {
  requireTauri();
  await invoke("notion_mark_idea_started", { pageId });
}

export function todayLocalIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function markNotionEssayPublished(
  pageId: string,
  publishDate: string = todayLocalIsoDate(),
): Promise<void> {
  requireTauri();
  await invoke("notion_mark_essay_published", { pageId, publishDate });
}

export async function testNotionIdeasConnection(): Promise<number> {
  requireTauri();
  return invoke<number>("notion_test_ideas_connection");
}

export async function setNotionPagePublicUrl(
  pageId: string,
  publicUrl: string,
): Promise<void> {
  requireTauri();
  await invoke("notion_set_page_public_url", { pageId, publicUrl });
}

function createdDateFromNotion(iso: string): string {
  if (!iso) return todayCollectDateCreated();
  const d = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayCollectDateCreated();
}

/** Map a Notion page into a CollectItem. */
export function notionPageToCollectItem(page: NotionIdeaPage): CollectItem {
  const base = createCollectItem();
  return {
    ...base,
    id: `notion:${page.pageId}`,
    preview: page.title.trim() || "Untitled",
    dateCreated: createdDateFromNotion(page.createdTime),
    body: page.notes.trim() || undefined,
    notionPageId: page.pageId,
    status: page.status.trim() || undefined,
  };
}

/**
 * Replace the Ideas list with Notion pages (Status = Idea).
 * Local-only rows are dropped — Ideas is Notion-sourced only.
 */
export function mergeNotionIdeasIntoCollectItems(
  _current: CollectItem[],
  pages: NotionIdeaPage[],
): CollectItem[] {
  const dismissed = new Set(readDismissedNotionIdeaIds());
  const byNotionId = new Map<string, CollectItem>();
  for (const item of _current) {
    if (item.notionPageId) {
      byNotionId.set(item.notionPageId, item);
    }
  }

  return pages
    .filter((page) => !dismissed.has(page.pageId))
    .map((page) => {
      const existing = byNotionId.get(page.pageId);
      const next = notionPageToCollectItem(page);
      if (existing) {
        return {
          ...existing,
          preview: next.preview,
          body: next.body,
          dateCreated: next.dateCreated,
          notionPageId: page.pageId,
          status: next.status,
        };
      }
      return next;
    });
}
