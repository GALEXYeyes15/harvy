import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";
import type { FileNode } from "./types";

export type MarkdownSearchHit = {
  path: string;
  name: string;
  count: number;
};

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Non-overlapping case-insensitive spans of `needle` in `haystack`. */
export function findCaseInsensitiveRanges(
  haystack: string,
  needle: string,
): Array<{ start: number; end: number }> {
  const pin = needle.trim();
  if (!pin) return [];
  const re = new RegExp(escapeRegExp(pin), "gi");
  const out: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(haystack)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (end > start) out.push({ start, end });
    if (match[0].length === 0) re.lastIndex += 1;
  }
  return out;
}

export function searchHitsToFileNodes(hits: MarkdownSearchHit[]): FileNode[] {
  return hits.map((hit) => ({
    name: hit.name,
    path: hit.path,
    kind: "file",
    searchHitCount: hit.count,
  }));
}

export async function searchWorkspaceMarkdown(query: string): Promise<FileNode[]> {
  const needle = query.trim();
  if (!needle || !isTauriRuntime()) return [];
  const hits = await invoke<MarkdownSearchHit[]>("search_workspace_markdown", { query: needle });
  return searchHitsToFileNodes(hits);
}
