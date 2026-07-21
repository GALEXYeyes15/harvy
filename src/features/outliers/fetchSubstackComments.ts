import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";
import type { OutlierPost } from "./outlierPosts";

export type SubstackComment = {
  id: string;
  authorName: string;
  handle: string;
  body: string;
  date: string;
  likes: number;
  photoUrl?: string | null;
  bodyJson?: unknown;
  replies: SubstackComment[];
};

export type SubstackSourceRef = {
  kind: "newsletter" | "note";
  sourceId: number;
  subdomain: string;
};

/** Parse `newsletter-123` / `note-456` ids used by the Substack fetch layer. */
export function parseSubstackSourceRef(post: OutlierPost): SubstackSourceRef | null {
  const match = /^(newsletter|note)-(\d+)$/.exec(post.id);
  if (!match) return null;
  const kind = match[1] as "newsletter" | "note";
  const sourceId = Number(match[2]);
  if (!Number.isFinite(sourceId)) return null;
  return {
    kind,
    sourceId,
    subdomain: post.subdomain?.trim() || "",
  };
}

export async function fetchSubstackComments(
  ref: SubstackSourceRef,
): Promise<SubstackComment[]> {
  if (isTauriRuntime()) {
    return invoke<SubstackComment[]>("fetch_substack_comments", {
      kind: ref.kind,
      sourceId: ref.sourceId,
      subdomain: ref.subdomain,
    });
  }

  const params = new URLSearchParams({
    kind: ref.kind,
    sourceId: String(ref.sourceId),
    subdomain: ref.subdomain,
  });
  const response = await fetch(`/api/substack/comments?${params}`);
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || `Comments request failed (${response.status})`);
  }
  const payload = (await response.json()) as { results?: SubstackComment[] };
  return Array.isArray(payload.results) ? payload.results : [];
}
