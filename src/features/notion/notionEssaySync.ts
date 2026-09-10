import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";

export const DOCUMENT_NOTION_SUFFIX = ".harvy-notion.json";

export type NotionEssayLink = {
  parentPageId: string;
  essayPageId: string;
  renameParent: boolean;
  parentUrl: string;
  essayUrl: string;
  publicUrl: string;
};

export type NotionSyncEssayResult = {
  parentPageId: string;
  essayPageId: string;
  renameParent: boolean;
  parentUrl: string;
  essayUrl: string;
};

export function documentNotionSidecarPath(sourcePath: string): string {
  return `${sourcePath}${DOCUMENT_NOTION_SUFFIX}`;
}

export function parseNotionEssayLink(raw: string): NotionEssayLink | null {
  try {
    const parsed = JSON.parse(raw) as Partial<NotionEssayLink>;
    const parentPageId =
      typeof parsed.parentPageId === "string" ? parsed.parentPageId.trim() : "";
    const essayPageId =
      typeof parsed.essayPageId === "string" ? parsed.essayPageId.trim() : "";
    const parentUrl = typeof parsed.parentUrl === "string" ? parsed.parentUrl.trim() : "";
    const essayUrl = typeof parsed.essayUrl === "string" ? parsed.essayUrl.trim() : "";
    const publicUrl = typeof parsed.publicUrl === "string" ? parsed.publicUrl.trim() : "";
    if (!parentPageId && !essayPageId && !publicUrl) return null;
    return {
      parentPageId,
      essayPageId,
      renameParent: Boolean(parsed.renameParent),
      parentUrl,
      essayUrl,
      publicUrl,
    };
  } catch {
    return null;
  }
}

export function notionLinkFromFields(fields: {
  notionParentPageId?: string;
  notionEssayPageId?: string;
  notionRenameParent?: boolean;
  notionParentUrl?: string;
  notionEssayUrl?: string;
  publicUrl?: string;
}): NotionEssayLink | null {
  const parentPageId = fields.notionParentPageId?.trim() ?? "";
  const essayPageId = fields.notionEssayPageId?.trim() ?? "";
  const publicUrl = fields.publicUrl?.trim() ?? "";
  if (!parentPageId && !essayPageId && !publicUrl) return null;
  return {
    parentPageId,
    essayPageId,
    renameParent: Boolean(fields.notionRenameParent),
    parentUrl: fields.notionParentUrl?.trim() ?? "",
    essayUrl: fields.notionEssayUrl?.trim() ?? "",
    publicUrl,
  };
}

export function notionFieldsFromLink(link: NotionEssayLink | null): {
  notionParentPageId: string;
  notionEssayPageId: string;
  notionRenameParent: boolean;
  notionParentUrl: string;
  notionEssayUrl: string;
  publicUrl: string;
} {
  return {
    notionParentPageId: link?.parentPageId.trim() ?? "",
    notionEssayPageId: link?.essayPageId.trim() ?? "",
    notionRenameParent: Boolean(link?.renameParent),
    notionParentUrl: link?.parentUrl.trim() ?? "",
    notionEssayUrl: link?.essayUrl.trim() ?? "",
    publicUrl: link?.publicUrl.trim() ?? "",
  };
}

export function mergeNotionEssayLink(
  primary: NotionEssayLink | null,
  fallback: NotionEssayLink | null,
): NotionEssayLink | null {
  if (!primary && !fallback) return null;
  const merged: NotionEssayLink = {
    parentPageId: primary?.parentPageId.trim() || fallback?.parentPageId.trim() || "",
    essayPageId: primary?.essayPageId.trim() || fallback?.essayPageId.trim() || "",
    renameParent: Boolean(primary?.renameParent || fallback?.renameParent),
    parentUrl: primary?.parentUrl.trim() || fallback?.parentUrl.trim() || "",
    essayUrl: primary?.essayUrl.trim() || fallback?.essayUrl.trim() || "",
    publicUrl: primary?.publicUrl.trim() || fallback?.publicUrl.trim() || "",
  };
  if (!merged.parentPageId && !merged.essayPageId && !merged.publicUrl) return null;
  return merged;
}

export async function loadNotionEssayLink(
  sourcePath: string,
): Promise<NotionEssayLink | null> {
  if (!isTauriRuntime() || !sourcePath.trim()) return null;
  try {
    const raw = await invoke<string>("read_workspace_text_file", {
      path: documentNotionSidecarPath(sourcePath),
    });
    return parseNotionEssayLink(raw);
  } catch {
    return null;
  }
}

export async function saveNotionEssayLink(
  sourcePath: string,
  link: NotionEssayLink,
): Promise<void> {
  if (!isTauriRuntime() || !sourcePath.trim()) return;
  await invoke("write_text_file", {
    path: documentNotionSidecarPath(sourcePath),
    contents: `${JSON.stringify(
      {
        parentPageId: link.parentPageId,
        essayPageId: link.essayPageId,
        renameParent: link.renameParent,
        parentUrl: link.parentUrl,
        essayUrl: link.essayUrl,
        publicUrl: link.publicUrl,
      },
      null,
      2,
    )}\n`,
  });
}

export async function renameNotionEssaySidecar(
  fromPath: string,
  toPath: string,
): Promise<void> {
  if (!isTauriRuntime() || !fromPath.trim() || !toPath.trim()) return;
  try {
    await invoke("rename_fs_path", {
      fromPath: documentNotionSidecarPath(fromPath),
      toPath: documentNotionSidecarPath(toPath),
    });
  } catch {
    // No sidecar yet.
  }
}

export async function syncEssayWithNotion(input: {
  title: string;
  markdown: string;
  parentPageId?: string;
  essayPageId?: string;
  renameParent?: boolean;
}): Promise<NotionSyncEssayResult> {
  if (!isTauriRuntime()) {
    throw new Error("Sync with Notion requires the Harvy desktop app.");
  }
  return invoke<NotionSyncEssayResult>("notion_sync_essay", {
    input: {
      title: input.title,
      markdown: input.markdown,
      parentPageId: input.parentPageId ?? null,
      essayPageId: input.essayPageId ?? null,
      renameParent: Boolean(input.renameParent),
    },
  });
}
