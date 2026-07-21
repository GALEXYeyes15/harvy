import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";
import {
  formatCompactCount,
  formatOutlierMultiple,
  formatPostedAgo,
  type OutlierPost,
} from "./outlierPosts";
import {
  isSubstackOutliersCacheFresh,
  readSubstackOutliersCache,
  writeSubstackOutliersCache,
} from "./substackOutliersCache";

export type SubstackPostResult = {
  id: string;
  title: string;
  preview: string;
  postDate: string;
  canonicalUrl: string;
  likes: number;
  /** Newsletter comments or Note replies. */
  comments?: number;
  restacks: number;
  coverImage: string | null;
  creatorName: string;
  handle: string;
  subdomain: string;
  creatorPhotoUrl?: string | null;
  kind?: "newsletter" | "note" | string;
  bodyJson?: unknown;
};

export const DEFAULT_SUBSTACK_ACCOUNT_URL = "https://substack.com/@alexlacy";

export function scoreSubstackPosts(raw: SubstackPostResult[]): OutlierPost[] {
  const likeCounts = raw.map((post) => Math.max(0, post.likes));
  const total = likeCounts.reduce((sum, n) => sum + n, 0);
  const average = likeCounts.length > 0 ? total / likeCounts.length : 0;

  return raw.map((post, index) => {
    const likes = likeCounts[index] ?? 0;
    const multiple = average > 0 ? likes / average : 0;
    const hasThumbnail = Boolean(post.coverImage);

    const isNote = post.kind === "note";
    const preview = post.preview.trim() || post.title;
    const commentsCount = Math.max(0, post.comments ?? 0);
    const restacksCount = Math.max(0, post.restacks ?? 0);

    return {
      id: post.id,
      creatorName: post.creatorName,
      creatorPhotoUrl: post.creatorPhotoUrl ?? null,
      handle: post.handle,
      platform: isNote ? "Note" : "Substack",
      postedAgo: formatPostedAgo(post.postDate),
      postDateIso: post.postDate,
      preview,
      likes: formatCompactCount(likes),
      likesCount: likes,
      comments: formatCompactCount(commentsCount),
      commentsCount,
      restacks: formatCompactCount(restacksCount),
      restacksCount,
      // Substack does not expose view counts on public archive/Notes endpoints.
      views: "—",
      outlierMultiple: formatOutlierMultiple(multiple),
      outlierMultipleValue: multiple,
      hasThumbnail,
      thumbnailUrl: post.coverImage,
      thumbnailTone: hasThumbnail ? "slate" : undefined,
      thumbnailHeight: hasThumbnail ? "short" : undefined,
      captionBelowThumbnail:
        !isNote && post.title !== preview ? post.title : undefined,
      canonicalUrl: post.canonicalUrl,
      subdomain: post.subdomain,
      noteBodyJson: isNote ? post.bodyJson : undefined,
    };
  });
}

async function fetchSubstackPostsFromNetwork(
  accountUrl: string,
): Promise<SubstackPostResult[]> {
  if (isTauriRuntime()) {
    return invoke<SubstackPostResult[]>("fetch_substack_posts", {
      accountUrl,
    });
  }

  const response = await fetch(
    `/api/substack/posts?url=${encodeURIComponent(accountUrl)}`,
  );
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || `Substack request failed (${response.status})`);
  }
  const payload = (await response.json()) as { results?: SubstackPostResult[] };
  return Array.isArray(payload.results) ? payload.results : [];
}

export type FetchSubstackOutlierPostsOptions = {
  /** Skip serving cache and always hit the network (e.g. Apply in settings). */
  forceRefresh?: boolean;
};

export type FetchSubstackOutlierPostsResult = {
  posts: OutlierPost[];
  fromCache: boolean;
  /** True when a network fetch ran and updated the local cache. */
  refreshed: boolean;
};

/**
 * Serves the last persisted fetch whenever available (offline-friendly).
 * Hits the network when cache is missing, stale, or `forceRefresh` is set.
 * Outliers UI only calls this with `forceRefresh` after an explicit Fetch posts.
 * On network failure, falls back to the last cache instead of throwing when one exists.
 */
export async function fetchSubstackOutlierPosts(
  accountUrl: string,
  options: FetchSubstackOutlierPostsOptions = {},
): Promise<FetchSubstackOutlierPostsResult> {
  const trimmed = accountUrl.trim();
  if (!trimmed) {
    throw new Error("Enter a Substack profile URL.");
  }

  const cached = readSubstackOutliersCache(trimmed);
  const canServeCache = Boolean(cached);
  const cacheFresh = Boolean(cached && isSubstackOutliersCacheFresh(cached));

  if (!options.forceRefresh && cached && cacheFresh) {
    return {
      posts: scoreSubstackPosts(cached.results),
      fromCache: true,
      refreshed: false,
    };
  }

  // Stale-but-present cache: callers typically already painted it; still try to refresh.
  // Missing cache or forceRefresh: must hit the network (or fall back if force fails).
  try {
    const results = await fetchSubstackPostsFromNetwork(trimmed);
    writeSubstackOutliersCache(trimmed, results);
    return {
      posts: scoreSubstackPosts(results),
      fromCache: false,
      refreshed: true,
    };
  } catch (error) {
    if (canServeCache && cached) {
      return {
        posts: scoreSubstackPosts(cached.results),
        fromCache: true,
        refreshed: false,
      };
    }
    throw error;
  }
}

/** Instant scored posts from localStorage, if any (any age — for offline-first paint). */
export function readCachedSubstackOutlierPosts(
  accountUrl: string,
): OutlierPost[] | null {
  const cached = readSubstackOutliersCache(accountUrl);
  if (!cached) return null;
  return scoreSubstackPosts(cached.results);
}

export function isCachedSubstackOutliersFresh(accountUrl: string): boolean {
  const cached = readSubstackOutliersCache(accountUrl);
  return Boolean(cached && isSubstackOutliersCacheFresh(cached));
}

/** True when a previous successful fetch is stored (usable offline). */
export function hasCachedSubstackOutliers(accountUrl: string): boolean {
  return readSubstackOutliersCache(accountUrl) != null;
}
