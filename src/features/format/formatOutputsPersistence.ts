import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../save/saveRuntime";
import type { FormatCategoryId } from "./formatCategories";
import type { GeneratedTwitterCollection } from "./formatGeneratedOutputs";
import { tweetItemsFromCollection } from "./formatGeneratedOutputs";
import type { FormatCollectionResult } from "./formatOutputTypes";
import { parseFormatCollectionResult } from "./generation/parseFormatCollectionResult";
import type { TweetItem } from "./tweetCollection";

const STORAGE_PREFIX = "harvy-format-outputs:";

function readWebStoredCollection(
  documentKey: string,
  category: FormatCategoryId,
): FormatCollectionResult | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${documentKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (parsed.collections && typeof parsed.collections === "object") {
      const collections = parsed.collections as Record<string, unknown>;
      const stored = collections[category];
      if (stored) return parseFormatCollectionResult(stored, category);
    }

    if (category === "tweets_notes") {
      return parseFormatCollectionResult(parsed, "tweets_notes");
    }
    return null;
  } catch {
    return null;
  }
}

function writeWebStoredCollection(
  documentKey: string,
  category: FormatCategoryId,
  collection: FormatCollectionResult,
): void {
  if (typeof localStorage === "undefined") return;

  let existing: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${documentKey}`);
    if (raw) existing = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    existing = {};
  }

  const collections =
    existing.collections && typeof existing.collections === "object"
      ? { ...(existing.collections as Record<string, unknown>) }
      : {};

  collections[category] = collection;

  localStorage.setItem(
    `${STORAGE_PREFIX}${documentKey}`,
    JSON.stringify({ ...existing, collections }),
  );
}

function documentStorageKey(documentId: string | null, essayTitle: string): string {
  return documentId?.trim() || essayTitle.trim() || "scratch";
}

export async function loadPersistedFormatCollection(
  category: FormatCategoryId,
  documentId: string | null,
  essayTitle: string,
): Promise<FormatCollectionResult | null> {
  if (isTauriRuntime()) {
    try {
      const result = await invoke<FormatCollectionResult | null>("load_format_collection", {
        category,
        documentId: documentId ?? null,
        essayTitle,
      });
      return result;
    } catch {
      return null;
    }
  }

  return readWebStoredCollection(documentStorageKey(documentId, essayTitle), category);
}

export async function savePersistedFormatCollection(
  category: FormatCategoryId,
  documentId: string | null,
  essayTitle: string,
  collection: FormatCollectionResult,
): Promise<void> {
  if (isTauriRuntime()) {
    await invoke("save_format_collection", {
      category,
      documentId: documentId ?? null,
      essayTitle,
      collection,
    });
    return;
  }

  writeWebStoredCollection(documentStorageKey(documentId, essayTitle), category, collection);
}

export async function loadPersistedTwitterFormats(
  documentId: string | null,
  essayTitle: string,
): Promise<GeneratedTwitterCollection | null> {
  const collection = await loadPersistedFormatCollection("tweets_notes", documentId, essayTitle);
  if (!collection) return null;
  return tweetItemsFromCollection(collection);
}

export async function savePersistedTwitterFormats(
  documentId: string | null,
  essayTitle: string,
  collection: GeneratedTwitterCollection,
): Promise<void> {
  await savePersistedFormatCollection("tweets_notes", documentId, essayTitle, {
    category: "tweets_notes",
    type: "collection",
    title: collection.title,
    items: collection.tweets.map((tweet) => ({
      id: tweet.id,
      title: null,
      content: tweet.text,
      status:
        tweet.status === "edited" ||
        tweet.status === "favorite" ||
        tweet.status === "published"
          ? tweet.status
          : "draft",
      favorite: tweet.status === "favorite",
    })),
  });
}

export function tweetsToGeneratedCollection(tweets: TweetItem[]): GeneratedTwitterCollection {
  return {
    title: `Tweets / Notes — ${tweets.length} generated`,
    tweets,
  };
}
