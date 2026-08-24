import { invoke } from "@tauri-apps/api/core";
import type { MediumPostResult } from "../../server/mediumArchive";
import type { YoutubeVideoResult } from "../../server/youtubeArchive";
import { isTauriRuntime } from "../save/saveRuntime";
import {
  scoreSubstackPosts,
  type SubstackPostResult,
} from "./fetchSubstackOutliers";
import type { OutlierPost } from "./outlierPosts";
import {
  isOutliersCacheFresh,
  outliersCacheKey,
  readOutliersCacheEntry,
  writeOutliersCacheEntry,
  type OutliersCacheEntry,
} from "./outliersCache";
import { outliersFetchIntervalMs } from "./outliersSettings";
import type { OutlierSource } from "./outlierSources";
import { scoreMediumPosts, scoreYoutubeVideos } from "./scorePlatformOutliers";
import {
  readSubstackOutliersCache,
} from "./substackOutliersCache";

export type FetchOutlierSourceResult = {
  posts: OutlierPost[];
  fromCache: boolean;
  refreshed: boolean;
  error?: string;
};

function postsFromCacheEntry(source: OutlierSource, entry: OutliersCacheEntry): OutlierPost[] {
  if (source.platform === "substack") {
    const raw = (entry.results.substack ?? []) as SubstackPostResult[];
    return scoreSubstackPosts(raw, source.id);
  }
  if (source.platform === "medium") {
    const raw = (entry.results.medium ?? []) as MediumPostResult[];
    return scoreMediumPosts(raw, source.id);
  }
  const raw = (entry.results.youtube ?? []) as YoutubeVideoResult[];
  return scoreYoutubeVideos(raw, source.id);
}

async function fetchSubstackFromNetwork(url: string): Promise<SubstackPostResult[]> {
  if (isTauriRuntime()) {
    return invoke<SubstackPostResult[]>("fetch_substack_posts", { accountUrl: url });
  }
  const response = await fetch(`/api/substack/posts?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || `Substack request failed (${response.status})`);
  }
  const payload = (await response.json()) as { results?: SubstackPostResult[] };
  return Array.isArray(payload.results) ? payload.results : [];
}

async function fetchMediumFromNetwork(url: string): Promise<MediumPostResult[]> {
  if (isTauriRuntime()) {
    return invoke<MediumPostResult[]>("fetch_medium_posts", { sourceUrl: url });
  }
  const response = await fetch(`/api/medium/posts?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || `Medium request failed (${response.status})`);
  }
  const payload = (await response.json()) as { results?: MediumPostResult[] };
  return Array.isArray(payload.results) ? payload.results : [];
}

async function fetchYoutubeFromNetwork(url: string): Promise<YoutubeVideoResult[]> {
  if (isTauriRuntime()) {
    return invoke<YoutubeVideoResult[]>("fetch_youtube_videos", { sourceUrl: url });
  }
  const response = await fetch(`/api/youtube/videos?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || `YouTube request failed (${response.status})`);
  }
  const payload = (await response.json()) as { results?: YoutubeVideoResult[] };
  return Array.isArray(payload.results) ? payload.results : [];
}

async function fetchSourceFromNetwork(source: OutlierSource): Promise<OutliersCacheEntry["results"]> {
  if (source.platform === "substack") {
    const results = await fetchSubstackFromNetwork(source.url);
    return { substack: results };
  }
  if (source.platform === "medium") {
    const results = await fetchMediumFromNetwork(source.url);
    return { medium: results };
  }
  const results = await fetchYoutubeFromNetwork(source.url);
  return { youtube: results };
}

export async function fetchOutlierSourcePosts(
  source: OutlierSource,
  options: { forceRefresh?: boolean } = {},
): Promise<FetchOutlierSourceResult> {
  const key = outliersCacheKey(source.id, source.platform, source.url);
  const cached = readOutliersCacheEntry(key);
  const canServeCache = Boolean(cached);
  const cacheFresh = Boolean(
    cached && isOutliersCacheFresh(cached, Date.now(), outliersFetchIntervalMs()),
  );

  if (!options.forceRefresh && cached && cacheFresh) {
    return {
      posts: postsFromCacheEntry(source, cached),
      fromCache: true,
      refreshed: false,
    };
  }

  try {
    const results = await fetchSourceFromNetwork(source);
    writeOutliersCacheEntry(key, {
      sourceId: source.id,
      platform: source.platform,
      sourceUrl: source.url,
      results,
    });
    const entry = readOutliersCacheEntry(key)!;
    return {
      posts: postsFromCacheEntry(source, entry),
      fromCache: false,
      refreshed: true,
    };
  } catch (error) {
    if (canServeCache && cached) {
      return {
        posts: postsFromCacheEntry(source, cached),
        fromCache: true,
        refreshed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    throw error;
  }
}

export function readCachedOutlierSourcePosts(source: OutlierSource): OutlierPost[] | null {
  const key = outliersCacheKey(source.id, source.platform, source.url);
  const cached = readOutliersCacheEntry(key);
  if (cached) return postsFromCacheEntry(source, cached);

  if (source.platform === "substack") {
    const legacy = readSubstackOutliersCache(source.url);
    if (legacy) return scoreSubstackPosts(legacy.results as SubstackPostResult[], source.id);
  }

  return null;
}

export function readCachedOutlierSourcesPosts(sources: OutlierSource[]): OutlierPost[] {
  const merged: OutlierPost[] = [];
  for (const source of sources) {
    const posts = readCachedOutlierSourcePosts(source);
    if (posts) merged.push(...posts);
  }
  merged.sort((a, b) => Date.parse(b.postDateIso) - Date.parse(a.postDateIso));
  return merged;
}

export async function fetchAllOutlierPosts(
  sources: OutlierSource[],
  options: { forceRefresh?: boolean } = {},
): Promise<{
  posts: OutlierPost[];
  refreshedAny: boolean;
  errors: string[];
}> {
  const results = await Promise.all(
    sources.map((source) =>
      fetchOutlierSourcePosts(source, options).catch((error) => ({
        posts: readCachedOutlierSourcePosts(source) ?? [],
        fromCache: true,
        refreshed: false,
        error: error instanceof Error ? error.message : String(error),
      })),
    ),
  );

  const merged: OutlierPost[] = [];
  const errors: string[] = [];
  let refreshedAny = false;
  for (const result of results) {
    merged.push(...result.posts);
    if (result.refreshed) refreshedAny = true;
    if (result.error) errors.push(result.error);
  }
  merged.sort((a, b) => Date.parse(b.postDateIso) - Date.parse(a.postDateIso));
  return { posts: merged, refreshedAny, errors };
}
