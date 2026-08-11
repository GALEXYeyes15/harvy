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
  hasToken: boolean;
};

export type NotionPropertyInfo = {
  name: string;
  propertyType: string;
};

/** Infer Title / Notes / Status property names from a Notion database schema. */
export function inferNotionIdeasPropertyMap(schema: NotionPropertyInfo[]): {
  titleProperty: string;
  notesProperty: string;
  statusProperty: string;
} {
  const title = schema.find((p) => p.propertyType === "title");
  const status =
    schema.find((p) => p.propertyType === "status") ??
    schema.find((p) => p.propertyType === "select" && /status/i.test(p.name)) ??
    schema.find((p) => p.propertyType === "select");
  const notes =
    schema.find(
      (p) =>
        p.propertyType === "rich_text" &&
        /note|body|summary|description|idea/i.test(p.name),
    ) ??
    schema.find((p) => p.propertyType === "rich_text") ??
    null;

  return {
    titleProperty: title?.name ?? "",
    notesProperty: notes?.name ?? "",
    statusProperty: status?.name ?? "",
  };
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
  keepExistingToken?: boolean;
};

const LAST_SYNCED_KEY = "harvy:notion-ideas-last-synced";

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

export async function testNotionIdeasConnection(): Promise<number> {
  requireTauri();
  return invoke<number>("notion_test_ideas_connection");
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
  const byNotionId = new Map<string, CollectItem>();
  for (const item of _current) {
    if (item.notionPageId) {
      byNotionId.set(item.notionPageId, item);
    }
  }

  return pages.map((page) => {
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
