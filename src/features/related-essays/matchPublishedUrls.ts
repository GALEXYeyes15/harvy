import { invoke } from "@tauri-apps/api/core";
import { parseDocumentFrontmatter, serializeDocumentWithFrontmatter } from "../editor/documentFrontmatter";
import { setNotionPagePublicUrl } from "../notion/notionIdeas";
import {
  loadNotionEssayLink,
  saveNotionEssayLink,
  type NotionEssayLink,
} from "../notion/notionEssaySync";
import { isTauriRuntime } from "../save/saveRuntime";
import type { FileNode } from "../workspace/types";
import {
  collectEssayMarkdownFiles,
  hydrateRelatedItemUrls,
  loadRelatedUrlsForPath,
  titleFromPath,
  type RelatedEssayItem,
} from "./relatedEssays";
import { guessSubstackPostUrl, titlesMatch } from "./titleMatch";
import { readCriteriaSidebarSettings } from "../sidebar/criteriaSidebarSettings";

export const PUBLIC_URLS_MATCHED_EVENT = "harvy:public-urls-matched";

export type PublishedUrlUpdate = {
  path: string;
  publicUrl: string;
};

export type MatchPublishedUrlsResult = {
  matched: number;
  unmatched: number;
  updates: PublishedUrlUpdate[];
};

type ArchivePost = {
  title?: string;
  canonicalUrl?: string;
  kind?: string;
};

async function fetchArchivePosts(archiveUrl: string): Promise<ArchivePost[]> {
  if (isTauriRuntime()) {
    return invoke<ArchivePost[]>("fetch_substack_posts", { accountUrl: archiveUrl });
  }
  const response = await fetch(`/api/substack/posts?url=${encodeURIComponent(archiveUrl)}`);
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || `Substack request failed (${response.status})`);
  }
  const payload = (await response.json()) as { results?: ArchivePost[] };
  return Array.isArray(payload.results) ? payload.results : [];
}

async function writePublicUrlOnDisk(path: string, publicUrl: string): Promise<NotionEssayLink> {
  const raw = await invoke<string>("read_workspace_text_file", { path });
  const { meta, body } = parseDocumentFrontmatter(raw);
  const nextMeta = { ...meta, publicUrl };
  await invoke("write_text_file", {
    path,
    contents: serializeDocumentWithFrontmatter(body, nextMeta),
  });
  const sidecar = (await loadNotionEssayLink(path)) ?? {
    parentPageId: meta.notionParentPageId,
    essayPageId: meta.notionEssayPageId,
    renameParent: meta.notionRenameParent,
    parentUrl: meta.notionParentUrl,
    essayUrl: meta.notionEssayUrl,
    publicUrl: "",
  };
  const nextLink: NotionEssayLink = {
    ...sidecar,
    parentPageId: sidecar.parentPageId || meta.notionParentPageId,
    essayPageId: sidecar.essayPageId || meta.notionEssayPageId,
    parentUrl: sidecar.parentUrl || meta.notionParentUrl,
    essayUrl: sidecar.essayUrl || meta.notionEssayUrl,
    publicUrl,
  };
  await saveNotionEssayLink(path, nextLink);
  const parentPageId = nextLink.parentPageId.trim();
  if (parentPageId) {
    try {
      await setNotionPagePublicUrl(parentPageId, publicUrl);
    } catch {
      // File still stores the URL even if Notion write fails.
    }
  }
  return nextLink;
}

function essayTitleForMatch(postTitle: string, path: string): string {
  return postTitle.trim() || titleFromPath(path);
}

export async function matchPublishedEssayUrls(opts: {
  archiveUrl: string;
  tree: FileNode | null | undefined;
}): Promise<MatchPublishedUrlsResult> {
  const archiveUrl = opts.archiveUrl.trim();
  if (!archiveUrl) {
    throw new Error("Add your Substack URL first.");
  }
  if (!isTauriRuntime()) {
    throw new Error("Matching published URLs requires the Harvy desktop app.");
  }
  const tree =
    opts.tree ??
    (await invoke<FileNode>("get_workspace_tree"));
  const files = collectEssayMarkdownFiles(tree);
  const posts = (await fetchArchivePosts(archiveUrl)).filter((post) => {
    const kind = (post.kind ?? "newsletter").toLowerCase();
    return kind !== "note";
  });
  const archive = posts
    .map((post) => ({
      title: (post.title ?? "").trim(),
      url: (post.canonicalUrl ?? "").trim(),
    }))
    .filter((post) => post.title && post.url);

  const usedUrls = new Set<string>();
  const updates: PublishedUrlUpdate[] = [];

  for (const file of files) {
    let raw = "";
    try {
      raw = await invoke<string>("read_workspace_text_file", { path: file.path });
    } catch {
      continue;
    }
    const { meta } = parseDocumentFrontmatter(raw);
    const title = essayTitleForMatch(meta.postTitle, file.path);
    const match = archive.find(
      (post) => !usedUrls.has(post.url) && titlesMatch(title, post.title),
    );
    if (!match) continue;
    usedUrls.add(match.url);
    if (meta.publicUrl.trim() === match.url) {
      updates.push({ path: file.path, publicUrl: match.url });
      continue;
    }
    await writePublicUrlOnDisk(file.path, match.url);
    updates.push({ path: file.path, publicUrl: match.url });
  }

  if (typeof window !== "undefined" && updates.length > 0) {
    window.dispatchEvent(new CustomEvent(PUBLIC_URLS_MATCHED_EVENT, { detail: updates }));
  }

  return {
    matched: updates.length,
    unmatched: Math.max(0, archive.length - usedUrls.size),
    updates,
  };
}

function publishedUrlForTitle(posts: ArchivePost[], title: string): string {
  const match = posts.find(
    (post) => titlesMatch(title, post.title ?? "") && (post.canonicalUrl ?? "").trim(),
  );
  return (match?.canonicalUrl ?? "").trim();
}

export async function resolveRelatedEssayHref(opts: {
  path?: string;
  title?: string;
}): Promise<string> {
  const path = opts.path?.trim() ?? "";
  const title = opts.title?.trim() || (path ? titleFromPath(path) : "");
  const archiveUrl = readCriteriaSidebarSettings().essaysArchiveUrl.trim();

  let publicUrl = "";
  let notionUrl = "";
  if (path) {
    const urls = await loadRelatedUrlsForPath(path);
    publicUrl = urls.publicUrl;
    notionUrl = urls.notionUrl;
  }
  if (publicUrl) return publicUrl;

  if (archiveUrl && title) {
    try {
      const posts = await fetchArchivePosts(archiveUrl);
      const matched = publishedUrlForTitle(posts, title);
      if (matched) {
        if (path) {
          try {
            await writePublicUrlOnDisk(path, matched);
          } catch {
            // Still use the URL even if the file write fails.
          }
        }
        return matched;
      }
    } catch {
      // Fall through to slug guess / Notion.
    }
    const guessed = guessSubstackPostUrl(archiveUrl, title);
    if (guessed) return guessed;
  }

  return notionUrl;
}

export async function hydrateRelatedEssayUrls(
  items: RelatedEssayItem[],
): Promise<RelatedEssayItem[]> {
  const disk = await hydrateRelatedItemUrls(items);
  const needsArchive = disk.some((item) => !item.publicUrl?.trim() && item.title?.trim());
  const archiveUrl = needsArchive ? readCriteriaSidebarSettings().essaysArchiveUrl.trim() : "";
  let posts: ArchivePost[] = [];
  if (archiveUrl) {
    try {
      posts = await fetchArchivePosts(archiveUrl);
    } catch {
      posts = [];
    }
  }

  const out: RelatedEssayItem[] = [];
  for (const item of disk) {
    let publicUrl = item.publicUrl?.trim() ?? "";
    let notionUrl = item.notionUrl?.trim() ?? "";
    if (!publicUrl && posts.length && item.title) {
      const matched = publishedUrlForTitle(posts, item.title);
      if (matched) {
        publicUrl = matched;
        if (item.path) {
          try {
            await writePublicUrlOnDisk(item.path, matched);
          } catch {
            // Keep the in-memory URL.
          }
        }
      }
    }
    if (!publicUrl && archiveUrl && item.title) {
      publicUrl = guessSubstackPostUrl(archiveUrl, item.title);
    }
    out.push({
      ...item,
      publicUrl,
      notionUrl,
    });
  }
  return out;
}
