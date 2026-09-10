import { invoke } from "@tauri-apps/api/core";
import { parseDocumentFrontmatter } from "../editor/documentFrontmatter";
import { loadNotionEssayLink } from "../notion/notionEssaySync";
import { isExactOpenDocument } from "../workspace/openDocumentTrail";
import { fileNameFromPath, isTauriRuntime } from "../save/saveRuntime";
import { splitFileBaseAndExtension } from "../workspace/folderNaming";
import type { FileNode } from "../workspace/types";

export const DOCUMENT_RELATED_SUFFIX = ".harvy-related.json";
export const MAX_RELATED_CANDIDATES = 40;
export const RELATED_EXCERPT_CHARS = 800;

export type RelatedEssayItem = {
  title: string;
  path: string;
  notionUrl?: string;
  publicUrl?: string;
  why?: string;
};

export type RelatedEssayCandidate = {
  id: string;
  title: string;
  excerpt: string;
  notionUrl: string;
  publicUrl: string;
};

type RelatedRankMatch = {
  id: string;
  why: string;
};

export function documentRelatedSidecarPath(sourcePath: string): string {
  return `${sourcePath}${DOCUMENT_RELATED_SUFFIX}`;
}

export function isEssayMarkdownFileName(name: string): boolean {
  if (!/\.(md|markdown|mkd)$/i.test(name)) return false;
  if (/\sNote\.(md|markdown|mkd)$/i.test(name)) return false;
  if (/\sCriteria\.(md|markdown|mkd)$/i.test(name)) return false;
  return true;
}

export function collectEssayMarkdownFiles(node: FileNode | null | undefined): FileNode[] {
  if (!node) return [];
  const out: FileNode[] = [];
  const walk = (current: FileNode) => {
    if (current.kind === "file") {
      if (isEssayMarkdownFileName(current.name)) out.push(current);
      return;
    }
    for (const child of current.children ?? []) walk(child);
  };
  walk(node);
  return out;
}

export function excerptFromMarkdown(body: string, maxChars = RELATED_EXCERPT_CHARS): string {
  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxChars) return plain;
  return `${plain.slice(0, maxChars).trimEnd()}…`;
}

export function titleFromPath(path: string): string {
  const { base } = splitFileBaseAndExtension(fileNameFromPath(path));
  return (base || "Untitled").trim();
}

export function preferredRelatedUrl(item: {
  publicUrl?: string;
  notionUrl?: string;
}): string {
  return item.publicUrl?.trim() || item.notionUrl?.trim() || "";
}

export function parseRelatedEssayItems(raw: string): RelatedEssayItem[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : [];
    const items: RelatedEssayItem[] = [];
    for (const entry of list) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Partial<RelatedEssayItem>;
      const path = typeof record.path === "string" ? record.path.trim() : "";
      const title = typeof record.title === "string" ? record.title.trim() : "";
      if (!path && !title) continue;
      items.push({
        title: title || titleFromPath(path),
        path,
        notionUrl: typeof record.notionUrl === "string" ? record.notionUrl.trim() : "",
        publicUrl: typeof record.publicUrl === "string" ? record.publicUrl.trim() : "",
        why: typeof record.why === "string" ? record.why.trim() : "",
      });
    }
    return items;
  } catch {
    return [];
  }
}

export async function loadRelatedEssayItems(
  sourcePath: string,
): Promise<RelatedEssayItem[]> {
  if (!isTauriRuntime() || !sourcePath.trim()) return [];
  try {
    const raw = await invoke<string>("read_workspace_text_file", {
      path: documentRelatedSidecarPath(sourcePath),
    });
    return parseRelatedEssayItems(raw);
  } catch {
    return [];
  }
}

export async function saveRelatedEssayItems(
  sourcePath: string,
  items: RelatedEssayItem[],
): Promise<void> {
  if (!isTauriRuntime() || !sourcePath.trim()) return;
  await invoke("write_text_file", {
    path: documentRelatedSidecarPath(sourcePath),
    contents: `${JSON.stringify({ items }, null, 2)}\n`,
  });
}

export async function renameRelatedEssaySidecar(
  fromPath: string,
  toPath: string,
): Promise<void> {
  if (!isTauriRuntime() || !fromPath.trim() || !toPath.trim()) return;
  try {
    await invoke("rename_fs_path", {
      fromPath: documentRelatedSidecarPath(fromPath),
      toPath: documentRelatedSidecarPath(toPath),
    });
  } catch {
    // No sidecar yet.
  }
}

async function loadCandidateFromPath(path: string): Promise<RelatedEssayCandidate | null> {
  try {
    const raw = await invoke<string>("read_workspace_text_file", { path });
    const { meta, body } = parseDocumentFrontmatter(raw);
    const excerpt = excerptFromMarkdown(body);
    if (!excerpt) return null;
    const sidecar = await loadNotionEssayLink(path);
    const publicUrl = meta.publicUrl.trim() || sidecar?.publicUrl.trim() || "";
    const notionUrl =
      meta.notionEssayUrl.trim() ||
      sidecar?.essayUrl.trim() ||
      meta.notionParentUrl.trim() ||
      sidecar?.parentUrl.trim() ||
      "";
    return {
      id: path,
      title: meta.postTitle.trim() || titleFromPath(path),
      excerpt,
      notionUrl,
      publicUrl,
    };
  } catch {
    return null;
  }
}

export async function gatherRelatedEssayCandidates(opts: {
  tree: FileNode | null | undefined;
  currentPath: string;
}): Promise<RelatedEssayCandidate[]> {
  const files = collectEssayMarkdownFiles(opts.tree);
  const out: RelatedEssayCandidate[] = [];
  for (const file of files) {
    if (out.length >= MAX_RELATED_CANDIDATES) break;
    if (opts.currentPath && isExactOpenDocument(file.path, opts.currentPath)) continue;
    const candidate = await loadCandidateFromPath(file.path);
    if (candidate) out.push(candidate);
  }
  return out;
}

export async function rankRelatedEssays(input: {
  title: string;
  excerpt: string;
  candidates: RelatedEssayCandidate[];
}): Promise<RelatedEssayItem[]> {
  if (!isTauriRuntime()) {
    throw new Error("Related essays are only available in the Harvy desktop app.");
  }
  if (input.candidates.length === 0) return [];
  const result = await invoke<{ matches?: RelatedRankMatch[] }>("ai_check_related_essays", {
    title: input.title,
    excerpt: input.excerpt,
    candidates: input.candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      excerpt: candidate.excerpt,
    })),
  });
  const byId = new Map(input.candidates.map((candidate) => [candidate.id, candidate]));
  const items: RelatedEssayItem[] = [];
  for (const match of result.matches ?? []) {
    const candidate = byId.get(match.id.trim());
    if (!candidate) continue;
    items.push({
      title: candidate.title,
      path: candidate.id,
      notionUrl: candidate.notionUrl,
      publicUrl: candidate.publicUrl,
      why: match.why.trim(),
    });
  }
  return items;
}
